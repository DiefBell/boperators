import { describe, expect, it } from "bun:test";
import { normalizeTypeName } from "./resolveExpressionType";

describe("normalizeTypeName", () => {
	it("returns simple type names unchanged", () => {
		expect(normalizeTypeName("string")).toBe("string");
		expect(normalizeTypeName("number")).toBe("number");
		expect(normalizeTypeName("boolean")).toBe("boolean");
		expect(normalizeTypeName("Vector3")).toBe("Vector3");
		expect(normalizeTypeName("void")).toBe("void");
	});

	it("strips import() prefix from a fully-qualified type name", () => {
		expect(normalizeTypeName('import("/path/to/file").Vector3')).toBe(
			"Vector3",
		);
		expect(normalizeTypeName('import("C:/Users/foo/bar.ts").MyClass')).toBe(
			"MyClass",
		);
	});

	it("strips multiple import() prefixes in a union type", () => {
		const input = 'import("/a.ts").Foo | import("/b.ts").Bar';
		expect(normalizeTypeName(input)).toBe("Foo | Bar");
	});

	it("strips import() prefix in an intersection type", () => {
		const input = 'import("/a.ts").Foo & import("/b.ts").Bar';
		expect(normalizeTypeName(input)).toBe("Foo & Bar");
	});

	it("returns an empty string unchanged", () => {
		expect(normalizeTypeName("")).toBe("");
	});

	it("strips import() prefix with backslash paths (Windows paths)", () => {
		expect(
			normalizeTypeName('import("C:/path/with spaces/file.ts").MyType'),
		).toBe("MyType");
	});
});
