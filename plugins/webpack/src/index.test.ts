import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import loader from "./index";

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

/**
 * Calls the loader synchronously and returns the callback arguments.
 * The loader body is fully synchronous so the callback fires before
 * this function returns.
 */
function callLoader(
	tmpDir: string,
	source: string,
	resourcePath: string,
	options: { project?: string } = {},
): { error: unknown; code: unknown; map: unknown } {
	let error: unknown;
	let code: unknown;
	let map: unknown;

	// biome-ignore lint/suspicious/noExplicitAny: mocking webpack loader context
	const context: any = {
		async: () => (err: unknown, result: unknown, sourceMap: unknown) => {
			error = err;
			code = result;
			map = sourceMap;
		},
		resourcePath,
		rootContext: tmpDir,
		getOptions: () => options,
	};

	loader.call(context, source, undefined);
	return { error, code, map };
}

describe("@boperators/webpack-loader", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "boperators-webpack-test-"));

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
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("transforms a binary overloaded expression", () => {
		const { error, code } = callLoader(
			tmpDir,
			USAGE_SOURCE,
			path.join(tmpDir, "usage.ts"),
		);
		expect(error).toBeNull();
		expect(code as string).toContain('Vec2["+"][0](a, b)');
	});

	it("provides a V3 source map for the transformed output", () => {
		const { map } = callLoader(
			tmpDir,
			USAGE_SOURCE,
			path.join(tmpDir, "usage.ts"),
		);
		expect(map).not.toBeNull();
		expect((map as { version: number }).version).toBe(3);
	});

	it("returns original source when no overloaded operators are used", () => {
		const { error, code, map } = callLoader(
			tmpDir,
			NOOP_SOURCE,
			path.join(tmpDir, "noop.ts"),
		);
		expect(error).toBeNull();
		expect(code).toBe(NOOP_SOURCE);
		expect(map).toBeNull();
	});

	it("returns original source when the file is not in the ts-morph project", () => {
		// A path outside the tsconfig include pattern (subdirectory not covered)
		const outsidePath = path.join(tmpDir, "sub", "unknown.ts");
		const { error, code } = callLoader(tmpDir, USAGE_SOURCE, outsidePath);
		expect(error).toBeNull();
		expect(code).toBe(USAGE_SOURCE);
	});

	it("accepts an explicit project option pointing to tsconfig", () => {
		const { error, code } = callLoader(
			tmpDir,
			USAGE_SOURCE,
			path.join(tmpDir, "usage.ts"),
			{ project: "tsconfig.json" },
		);
		expect(error).toBeNull();
		expect(code as string).toContain('Vec2["+"][0](a, b)');
	});

	it("calls the error callback when tsconfig cannot be found", () => {
		const { error } = callLoader(
			tmpDir,
			USAGE_SOURCE,
			path.join(tmpDir, "usage.ts"),
			{ project: "nonexistent.tsconfig.json" },
		);
		expect(error).toBeInstanceOf(Error);
	});
});
