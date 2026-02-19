import { describe, expect, it } from "bun:test";
import { computeEdits } from "./SourceMap";
import { toV3SourceMap } from "./v3SourceMap";

describe("toV3SourceMap", () => {
	it("always sets version to 3", () => {
		const result = toV3SourceMap([], "hello", "hello", "test.ts");
		expect(result.version).toBe(3);
	});

	it("sets file and sources to the provided filename", () => {
		const result = toV3SourceMap([], "hello", "hello", "MyFile.ts");
		expect(result.file).toBe("MyFile.ts");
		expect(result.sources).toEqual(["MyFile.ts"]);
	});

	it("stores the original text in sourcesContent", () => {
		const original = "const x = 1;";
		const result = toV3SourceMap([], original, original, "test.ts");
		expect(result.sourcesContent).toEqual([original]);
	});

	it("always has an empty names array", () => {
		const result = toV3SourceMap([], "hello", "hello", "test.ts");
		expect(result.names).toEqual([]);
	});

	it("produces a non-empty mappings string for single-line text", () => {
		const result = toV3SourceMap([], "hello", "hello", "test.ts");
		expect(typeof result.mappings).toBe("string");
		expect(result.mappings.length).toBeGreaterThan(0);
	});

	it("produces N-1 semicolons in mappings for N-line transformed text", () => {
		// A 3-line string requires 2 semicolons to separate the 3 line groups
		const threeLines = "line1\nline2\nline3";
		const result = toV3SourceMap([], threeLines, threeLines, "test.ts");
		const semicolonCount = (result.mappings.match(/;/g) ?? []).length;
		expect(semicolonCount).toBe(2);
	});

	it("produces a non-empty mappings string when there are edits", () => {
		const original = "const x = 1;";
		const transformed = "const x = 2;";
		const edits = computeEdits(original, transformed);
		const result = toV3SourceMap(edits, original, transformed, "test.ts");
		expect(result.mappings.length).toBeGreaterThan(0);
	});

	it("handles empty strings without throwing", () => {
		// An empty file still has one implicit line (line 0), so the mapping
		// is a single identity segment rather than an empty string.
		const result = toV3SourceMap([], "", "", "empty.ts");
		expect(result.version).toBe(3);
		expect(typeof result.mappings).toBe("string");
	});

	it("produces correct line count for multi-line transformed text with edits", () => {
		const original = "const a = 1;\nconst b = 2;\nconst c = 3;";
		const transformed = "const a = 10;\nconst b = 20;\nconst c = 30;";
		const edits = computeEdits(original, transformed);
		const result = toV3SourceMap(edits, original, transformed, "test.ts");
		// 3 lines → 2 semicolons separating line groups
		const semicolonCount = (result.mappings.match(/;/g) ?? []).length;
		expect(semicolonCount).toBe(2);
	});
});
