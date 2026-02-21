import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";
import { boperators } from "./index";

// Minimal Vec2 class with a static "+" overload
const VEC2_SOURCE = `
export class Vec2 {
	x: number;
	y: number;
	constructor(x: number, y: number) { this.x = x; this.y = y; }
	static readonly "+" = [
		(a: Vec2, b: Vec2): Vec2 => new Vec2(a.x + b.x, a.y + b.y),
	] as const;
}
`.trim();

// Usage file that uses the overloaded "+" operator
const USAGE_SOURCE = `
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
`.trim();

// File with no operator overloads — should pass through unchanged
const NOOP_SOURCE = `const x = 1 + 2;`;

describe("@boperators/plugin-vite", () => {
	let tmpDir: string;
	let plugin: Plugin;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "boperators-vite-test-"));

		// Minimal tsconfig covering all .ts files in the temp dir
		fs.writeFileSync(
			path.join(tmpDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2020", strict: true },
				include: ["./*.ts"],
			}),
		);

		fs.writeFileSync(path.join(tmpDir, "Vec2.ts"), VEC2_SOURCE);
		fs.writeFileSync(path.join(tmpDir, "usage.ts"), USAGE_SOURCE);
		fs.writeFileSync(path.join(tmpDir, "noop.ts"), NOOP_SOURCE);

		plugin = boperators();

		// Simulate Vite calling configResolved — we only need config.root
		// biome-ignore lint/suspicious/noExplicitAny: mocking Vite ResolvedConfig
		(plugin.configResolved as ((config: any) => void) | undefined)?.({
			root: tmpDir,
		});
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	/**
	 * Calls the plugin's transform hook directly.
	 * Our implementation does not use the Rollup plugin context (`this`),
	 * so an empty object is sufficient.
	 */
	function callTransform(
		source: string,
		filePath: string,
	): { code: string; map: unknown } | null | undefined {
		// biome-ignore lint/suspicious/noExplicitAny: mocking Rollup plugin context
		const fn = plugin.transform as
			| ((code: string, id: string) => any)
			| undefined;
		return fn?.call({} as never, source, filePath);
	}

	it("transforms a binary overloaded expression", () => {
		const result = callTransform(USAGE_SOURCE, path.join(tmpDir, "usage.ts"));
		expect(result).not.toBeNull();
		expect(result?.code).toContain('Vec2["+"][0](a, b)');
	});

	it("provides a V3 source map for the transformed output", () => {
		const result = callTransform(USAGE_SOURCE, path.join(tmpDir, "usage.ts"));
		expect(result?.map).toBeDefined();
		expect((result?.map as { version: number } | undefined)?.version).toBe(3);
	});

	it("returns null when no overloaded operators are used", () => {
		const result = callTransform(NOOP_SOURCE, path.join(tmpDir, "noop.ts"));
		expect(result).toBeNull();
	});

	it("returns null for virtual modules", () => {
		const result = callTransform(USAGE_SOURCE, "\0virtual:module");
		expect(result).toBeNull();
	});

	it("returns null for non-TypeScript files", () => {
		const result = callTransform(
			"const x = 1;",
			path.join(tmpDir, "script.js"),
		);
		expect(result).toBeNull();
	});

	it("strips Vite query strings from the file ID", () => {
		const result = callTransform(
			USAGE_SOURCE,
			`${path.join(tmpDir, "usage.ts")}?t=123456`,
		);
		expect(result?.code).toContain('Vec2["+"][0](a, b)');
	});

	it("re-transforms updated source on subsequent calls (HMR behaviour)", () => {
		const usagePath = path.join(tmpDir, "usage.ts");

		// First call — establishes the transformed state
		callTransform(USAGE_SOURCE, usagePath);

		// Second call with identical source — should still work (idempotent)
		const result = callTransform(USAGE_SOURCE, usagePath);
		expect(result?.code).toContain('Vec2["+"][0](a, b)');
	});

	it("accepts an explicit project option pointing to tsconfig", () => {
		const plugin2 = boperators({ project: "tsconfig.json" });
		// biome-ignore lint/suspicious/noExplicitAny: mocking Vite ResolvedConfig
		(plugin2.configResolved as ((config: any) => void) | undefined)?.({
			root: tmpDir,
		});

		// biome-ignore lint/suspicious/noExplicitAny: mocking Rollup plugin context
		const fn = plugin2.transform as
			| ((code: string, id: string) => any)
			| undefined;
		const result = fn?.call(
			{} as never,
			USAGE_SOURCE,
			path.join(tmpDir, "usage.ts"),
		);
		expect(result?.code).toContain('Vec2["+"][0](a, b)');
	});
});
