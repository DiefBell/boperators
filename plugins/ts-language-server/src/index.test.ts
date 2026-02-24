/**
 * Integration tests for the TypeScript Language Server plugin.
 *
 * These tests create a real `ts.LanguageService` with in-memory virtual files,
 * load the plugin's `create()` function, and assert on observable language
 * service behaviour: hover info, diagnostics, and source-map position remapping.
 *
 * Why no source-map access is needed:
 *   The boperators transformer expands `a + b` (5 chars) into
 *   `Vec2["+"](a, b)` (15 chars) — a shift of +10.  Any position in the
 *   transformed file that falls *after* the replacement lands outside the
 *   original source bounds.  We use that fact to distinguish "remapped" from
 *   "not remapped" in the diagnostic position test without ever reading the
 *   internal source-map cache.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import pluginInit from "../dist/index.js";

// ---------------------------------------------------------------------------
// Virtual source files
// ---------------------------------------------------------------------------

const VEC2_SOURCE = `
export class Vec2 {
	x: number;
	y: number;
	constructor(x: number, y: number) { this.x = x; this.y = y; }
	toString() { return \`Vec2(\${this.x}, \${this.y})\`; }
	/** Adds two vectors component-wise. */
	static "+"(a: Vec2, b: Vec2): Vec2 { return new Vec2(a.x + b.x, a.y + b.y); }
}`.trim();

// Used for hover and TS2365 absence tests.
const USAGE_SOURCE = [
	'import { Vec2 } from "./Vec2";',
	"const a = new Vec2(1, 2);",
	"const b = new Vec2(3, 4);",
	"const c = a + b;",
].join("\n");

// Used for the diagnostic position-remapping test.
// After transformation `a + b` (5 chars) → `Vec2["+"](a, b)` (15 chars),
// everything after the replacement shifts by +10.  The undeclared identifier
// `zzz` on the last line sits at a position that, in the transformed source,
// exceeds the original source length — so an un-remapped diagnostic would
// trivially fail the bounds check.
const USAGE_WITH_UNDECLARED = [
	'import { Vec2 } from "./Vec2";',
	"const a = new Vec2(1, 2);",
	"const b = new Vec2(3, 4);",
	"const c = a + b;",
	"zzz;",
].join("\n");

// Pre-computed position of `zzz` in USAGE_WITH_UNDECLARED.
const ZZZ_POS_IN_ORIGINAL = USAGE_WITH_UNDECLARED.lastIndexOf("zzz");

// ---------------------------------------------------------------------------
// LanguageServiceHost factory
// ---------------------------------------------------------------------------

function makeHost(files: Map<string, string>): ts.LanguageServiceHost {
	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2016,
		module: ts.ModuleKind.CommonJS,
		strict: false,
		skipLibCheck: true,
	};

	return {
		getCompilationSettings: () => compilerOptions,
		getScriptFileNames: () => [...files.keys()],
		getScriptVersion: () => "1",
		getScriptSnapshot: (fileName) => {
			const content = files.get(fileName);
			if (content !== undefined) return ts.ScriptSnapshot.fromString(content);
			// Fall back to the real filesystem for TypeScript lib files.
			try {
				return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf-8"));
			} catch {
				return undefined;
			}
		},
		getCurrentDirectory: () => "/",
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		fileExists: (fileName) => files.has(fileName) || existsSync(fileName),
		readFile: (fileName) => {
			const content = files.get(fileName);
			if (content !== undefined) return content;
			try {
				return readFileSync(fileName, "utf-8");
			} catch {
				return undefined;
			}
		},
		readDirectory: () => [],
		useCaseSensitiveFileNames: () => false,
		// Resolve relative imports to our virtual files.
		resolveModuleNames: (moduleNames, containingFile) =>
			moduleNames.map((name) => {
				if (!name.startsWith(".")) return undefined;
				const dir = containingFile.slice(
					0,
					containingFile.lastIndexOf("/") + 1,
				);
				const resolved = `${dir}${name.replace(/^\.\//, "")}.ts`;
				if (files.has(resolved)) {
					return {
						resolvedFileName: resolved,
						isExternalLibraryImport: false,
						extension: ts.Extension.Ts,
					};
				}
				return undefined;
			}),
	};
}

// ---------------------------------------------------------------------------
// Plugin loader
// ---------------------------------------------------------------------------

function makeIntegration(usageSource: string) {
	const files = new Map([
		["/Vec2.ts", VEC2_SOURCE],
		["/usage.ts", usageSource],
	]);

	const host = makeHost(files);
	const baseLS = ts.createLanguageService(host);

	// biome-ignore lint/suspicious/noExplicitAny: CJS `export =` interop
	const pluginModule = (pluginInit as any)({ typescript: ts });
	const pluginLS = pluginModule.create({
		languageService: baseLS,
		languageServiceHost: host,
		project: {
			getProjectName: () => "integration-test",
			projectService: { logger: { info: () => {} } },
		},
		config: {},
		serverHost: {},
	});

	// getSemanticDiagnostics reads `cache` AFTER the inner LS call, so the
	// source-map cache is populated on this first call.  For getQuickInfoAtPosition
	// (which reads cache BEFORE the inner call) this warm-up ensures the cache
	// is ready on the first hover query.
	pluginLS.getSemanticDiagnostics("/usage.ts");

	return { pluginLS };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LS plugin integration", () => {
	describe("hover info", () => {
		it("returns custom display parts when hovering over an overloaded operator", () => {
			const { pluginLS } = makeIntegration(USAGE_SOURCE);

			// Position of the '+' in 'a + b'.
			const plusPos = USAGE_SOURCE.indexOf("a + b") + 2; // +2 skips 'a '

			const hover = pluginLS.getQuickInfoAtPosition("/usage.ts", plusPos);

			expect(hover).toBeDefined();
			const joined =
				hover?.displayParts?.map((p: { text: string }) => p.text).join("") ??
				"";
			expect(joined).toContain("+");
			expect(joined).toContain("Vec2");
		});

		it("falls through to regular TypeScript hover for non-operator positions", () => {
			const { pluginLS } = makeIntegration(USAGE_SOURCE);

			// Hover over 'a' in 'const a = new Vec2(...)'.
			const aPos = USAGE_SOURCE.indexOf("const a") + "const ".length;

			const hover = pluginLS.getQuickInfoAtPosition("/usage.ts", aPos);

			// Should get normal TS hover, not our custom operator format.
			expect(hover).toBeDefined();
			const joined =
				hover?.displayParts?.map((p: { text: string }) => p.text).join("") ??
				"";
			expect(joined).not.toMatch(/Vec2 \+ Vec2/);
		});

		it("includes JSDoc extracted from the operator method", () => {
			const { pluginLS } = makeIntegration(USAGE_SOURCE);

			const plusPos = USAGE_SOURCE.indexOf("a + b") + 2;

			const hover = pluginLS.getQuickInfoAtPosition("/usage.ts", plusPos);

			expect(hover?.documentation?.[0]?.text).toContain("Adds two vectors");
		});
	});

	describe("diagnostics", () => {
		it("suppresses TS2365 for an overloaded binary expression", () => {
			const { pluginLS } = makeIntegration(USAGE_SOURCE);

			// Call again after warm-up to get the final diagnostics.
			const diagnostics = pluginLS.getSemanticDiagnostics("/usage.ts");
			const ts2365 = diagnostics.find((d: { code: number }) => d.code === 2365);

			// After transformation the operator expression is gone, so TypeScript
			// should not report "Operator '+' cannot be applied".
			expect(ts2365).toBeUndefined();
		});

		it("remaps diagnostic positions back to the original source coordinates", () => {
			const { pluginLS } = makeIntegration(USAGE_WITH_UNDECLARED);

			const diagnostics = pluginLS.getSemanticDiagnostics("/usage.ts");
			// TS2304: Cannot find name 'zzz'
			const ts2304 = diagnostics.find((d: { code: number }) => d.code === 2304);

			expect(ts2304).toBeDefined();
			if (!ts2304) return;

			// The transformation expands 'a + b' (5 chars) to 'Vec2["+"](a, b)'
			// (15 chars) — a shift of +10.  In the transformed file, 'zzz' on the
			// last line sits at ZZZ_POS_IN_ORIGINAL + 10, which exceeds
			// USAGE_WITH_UNDECLARED.length.  An un-remapped diagnostic would fail
			// this bounds check.
			expect(ts2304.start).toBeLessThan(USAGE_WITH_UNDECLARED.length);

			// With correct remapping the diagnostic must land on 'zzz'.
			expect(ts2304.start).toBe(ZZZ_POS_IN_ORIGINAL);
		});
	});
});
