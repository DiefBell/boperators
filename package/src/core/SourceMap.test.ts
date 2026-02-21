import { describe, expect, it } from "bun:test";
import { computeEdits } from "./SourceMap";

describe("computeEdits", () => {
	it("returns empty array for identical strings", () => {
		expect(computeEdits("hello", "hello")).toEqual([]);
	});

	it("returns empty array for two empty strings", () => {
		expect(computeEdits("", "")).toEqual([]);
	});

	it("handles pure insertion (empty original)", () => {
		expect(computeEdits("", "hello")).toEqual([
			{ origStart: 0, origEnd: 0, transStart: 0, transEnd: 5 },
		]);
	});

	it("handles pure deletion (empty transformed)", () => {
		expect(computeEdits("hello", "")).toEqual([
			{ origStart: 0, origEnd: 5, transStart: 0, transEnd: 0 },
		]);
	});

	it("handles complete replacement of short strings", () => {
		expect(computeEdits("foo", "bar")).toEqual([
			{ origStart: 0, origEnd: 3, transStart: 0, transEnd: 3 },
		]);
	});

	it("detects a middle replacement using suffix fallback on short strings", () => {
		// "foo BAR baz" → "foo REPLACED_TEXT baz"
		// String is too short for the 8-char anchor; suffix fallback is used.
		const edits = computeEdits("foo BAR baz", "foo REPLACED_TEXT baz");
		expect(edits).toHaveLength(1);
		expect(edits[0]).toEqual({
			origStart: 4,
			origEnd: 7,
			transStart: 4,
			transEnd: 17,
		});
	});

	it("detects a single-character change", () => {
		// "const r = a + b;" → "const r = a - b;"
		const edits = computeEdits("const r = a + b;", "const r = a - b;");
		expect(edits).toHaveLength(1);
		expect(edits[0]).toEqual({
			origStart: 12,
			origEnd: 13,
			transStart: 12,
			transEnd: 13,
		});
	});

	it("detects multiple separate edits", () => {
		// Two '+' replaced with '-' at positions 12 and 29
		const original = "const a = x + y; const b = p + q;";
		const transformed = "const a = x - y; const b = p - q;";
		const edits = computeEdits(original, transformed);
		expect(edits).toHaveLength(2);
		expect(edits[0]).toEqual({
			origStart: 12,
			origEnd: 13,
			transStart: 12,
			transEnd: 13,
		});
		expect(edits[1]).toEqual({
			origStart: 29,
			origEnd: 30,
			transStart: 29,
			transEnd: 30,
		});
	});

	it("uses anchor convergence for longer strings", () => {
		// The anchor "WORD|suf" appears in both strings at different offsets,
		// so the algorithm converges at "OLD" → "NEW" (the minimal differing prefix).
		const original = "prefix|OLDWORD|suffix_that_is_long_enough";
		const transformed = "prefix|NEWWORD|suffix_that_is_long_enough";
		const edits = computeEdits(original, transformed);
		expect(edits).toHaveLength(1);
		// original[7:10] = "OLD", transformed[7:10] = "NEW"
		expect(edits[0]).toEqual({
			origStart: 7,
			origEnd: 10,
			transStart: 7,
			transEnd: 10,
		});
	});

	it("handles trailing insertion", () => {
		expect(computeEdits("hello", "hello world")).toEqual([
			{ origStart: 5, origEnd: 5, transStart: 5, transEnd: 11 },
		]);
	});

	it("handles trailing deletion", () => {
		expect(computeEdits("hello world", "hello")).toEqual([
			{ origStart: 5, origEnd: 11, transStart: 5, transEnd: 5 },
		]);
	});

	it("correctly bounds a realistic operator-overload transformation", () => {
		// "a + b" gets replaced with a function call — the edit should cover
		// the expression but leave the surrounding code untouched.
		const original = "const result = a + b;";
		const transformed = 'const result = Vec["+"][0](a, b);';
		const edits = computeEdits(original, transformed);
		expect(edits.length).toBeGreaterThan(0);
		// The edit region in the original should not reference Vec
		const origRegion = original.slice(edits[0].origStart, edits[0].origEnd);
		expect(origRegion).not.toContain("Vec");
		// The edit region in the transformed should contain the call
		const transRegion = transformed.slice(
			edits[0].transStart,
			edits[0].transEnd,
		);
		expect(transRegion).toContain("Vec");
	});
});
