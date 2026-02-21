import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OnLoadArgs, OnLoadResult, Plugin, PluginBuild } from "esbuild";
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

type LoadCallback = (
	args: OnLoadArgs,
) => OnLoadResult | null | undefined | Promise<OnLoadResult | null | undefined>;

/**
 * Calls the plugin's setup hook with a mock PluginBuild, captures the
 * onLoad callback, then returns a helper that invokes it directly.
 *
 * A fresh plugin instance (and ts-morph project) is created for each call.
 * overloadFile() mutates the AST, so a shared instance would see no diff on
 * subsequent calls to the same file and return null.
 */
function setupPlugin(
	tmpDir: string,
	options: Parameters<typeof boperators>[0] = {},
): (filePath: string) => OnLoadResult | null | undefined {
	const plugin: Plugin = boperators(options);

	let loadCallback: LoadCallback | null = null;

	const mockBuild = {
		initialOptions: { absWorkingDir: tmpDir },
		onLoad(_opts: { filter: RegExp }, cb: LoadCallback) {
			loadCallback = cb;
		},
	} as unknown as PluginBuild;

	plugin.setup(mockBuild);

	return (filePath: string) =>
		loadCallback?.({
			path: filePath,
			namespace: "file",
			suffix: "",
			pluginData: null,
		}) ?? null;
}

describe("@boperators/plugin-esbuild", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "boperators-esbuild-test-"));

		// jsx: "preserve" is required for TypeScript to include .tsx files in the project
		fs.writeFileSync(
			path.join(tmpDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2020", strict: true, jsx: "preserve" },
				include: ["./*.ts", "./*.tsx"],
			}),
		);

		fs.writeFileSync(path.join(tmpDir, "Vec2.ts"), VEC2_SOURCE);
		fs.writeFileSync(path.join(tmpDir, "usage.ts"), USAGE_SOURCE);
		// Distinct name avoids TypeScript dropping the tsx file when a same-named
		// .ts sibling exists (TS prefers .ts over .tsx for the same module name)
		fs.writeFileSync(path.join(tmpDir, "usageJsx.tsx"), USAGE_SOURCE);
		fs.writeFileSync(path.join(tmpDir, "noop.ts"), NOOP_SOURCE);
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("transforms a binary overloaded expression", () => {
		const result = setupPlugin(tmpDir)(path.join(tmpDir, "usage.ts"));
		expect(result).not.toBeNull();
		expect((result as OnLoadResult).contents).toContain('Vec2["+"][0](a, b)');
	});

	it("sets loader to 'ts' for .ts files", () => {
		const result = setupPlugin(tmpDir)(path.join(tmpDir, "usage.ts"));
		expect((result as OnLoadResult).loader).toBe("ts");
	});

	it("sets loader to 'tsx' for .tsx files", () => {
		const result = setupPlugin(tmpDir)(path.join(tmpDir, "usageJsx.tsx"));
		expect((result as OnLoadResult).loader).toBe("tsx");
	});

	it("returns null when no overloaded operators are used", () => {
		const result = setupPlugin(tmpDir)(path.join(tmpDir, "noop.ts"));
		expect(result).toBeNull();
	});

	it("returns null for files outside the ts-morph project", () => {
		const result = setupPlugin(tmpDir)(
			path.join(tmpDir, "subdir", "unknown.ts"),
		);
		expect(result).toBeNull();
	});

	it("accepts an explicit project option", () => {
		const result = setupPlugin(tmpDir, { project: "tsconfig.json" })(
			path.join(tmpDir, "usage.ts"),
		);
		expect((result as OnLoadResult).contents).toContain('Vec2["+"][0](a, b)');
	});
});
