import { describe, expect, it, mock } from "bun:test";
import {
	type BopConfig,
	ErrorManager,
	OverloadStore,
	Project,
} from "boperators";
import {
	findOverloadEdits,
	getOverloadHoverInfo,
	simplifyTypeName,
} from "./helpers";

// Minimal config that silences all logging
const silentConfig: BopConfig = {
	errorOnWarning: false,
	logLevel: "silent",
	logger: { debug: mock(), info: mock(), warn: mock(), error: mock() },
};

// Minimal mock of the TypeScript language service runtime.
// getOverloadHoverInfo only uses ts.ScriptElementKind.functionElement.
// biome-ignore lint/suspicious/noExplicitAny: intentional test mock
const mockTs = { ScriptElementKind: { functionElement: "function" } } as any;

// A minimal in-memory Vec2 class with static "+" and "-" overloads.
const VEC2_SOURCE = `
export class Vec2 {
	x: number;
	y: number;
	constructor(x: number, y: number) { this.x = x; this.y = y; }
	/** Adds two vectors component-wise. */
	static "+"(a: Vec2, b: Vec2): Vec2 { return new Vec2(a.x + b.x, a.y + b.y); }
	static "-"(a: Vec2, b: Vec2): Vec2 { return new Vec2(a.x - b.x, a.y - b.y); }
}
`.trim();

function makeProject() {
	const project = new Project({ useInMemoryFileSystem: true });
	const vec2File = project.createSourceFile("/Vec2.ts", VEC2_SOURCE);
	const errorManager = new ErrorManager(silentConfig);
	const store = new OverloadStore(project, errorManager, silentConfig.logger);
	store.addOverloadsFromFile(vec2File);
	return { project, store };
}

// ----- simplifyTypeName -----

describe("simplifyTypeName", () => {
	it("strips an import() prefix from a type name", () => {
		expect(simplifyTypeName('import("/path/to/Vec2").Vec2')).toBe("Vec2");
	});

	it("strips import() prefixes from all type arguments in a generic", () => {
		expect(simplifyTypeName('Map<import("/a").A, import("/b").B>')).toBe(
			"Map<A, B>",
		);
	});

	it("leaves a plain type name unchanged", () => {
		expect(simplifyTypeName("Vec2")).toBe("Vec2");
		expect(simplifyTypeName("number")).toBe("number");
	});

	it("leaves an empty string unchanged", () => {
		expect(simplifyTypeName("")).toBe("");
	});
});

// ----- findOverloadEdits -----

describe("findOverloadEdits", () => {
	it("returns one edit for a single overloaded binary expression", () => {
		const { project, store } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage.ts",
			[
				'import { Vec2 } from "./Vec2";',
				"const a = new Vec2(1, 2);",
				"const b = new Vec2(3, 4);",
				"const c = a + b;",
			].join("\n"),
		);

		const edits = findOverloadEdits(usageFile, store);

		expect(edits.length).toBe(1);
		expect(edits[0].kind).toBe("binary");
		expect(edits[0].className).toBe("Vec2");
		expect(edits[0].operatorString).toBe("+");
		expect(edits[0].isStatic).toBe(true);
		expect(typeof edits[0].lhsType).toBe("string");
		expect(typeof edits[0].rhsType).toBe("string");
		expect(typeof edits[0].returnType).toBe("string");
	});

	it("returns multiple edits when multiple overloaded expressions appear", () => {
		const { project, store } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage2.ts",
			[
				'import { Vec2 } from "./Vec2";',
				"const a = new Vec2(1, 2);",
				"const b = new Vec2(3, 4);",
				"const c = a + b;",
				"const d = a - b;",
			].join("\n"),
		);

		const edits = findOverloadEdits(usageFile, store);

		expect(edits.length).toBe(2);
		expect(edits.map((e) => e.operatorString).sort()).toEqual(
			["+", "-"].sort(),
		);
	});

	it("returns no edits when no overloads match", () => {
		const { project, store } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage3.ts",
			"const x = 1 + 2;",
		);

		const edits = findOverloadEdits(usageFile, store);

		expect(edits.length).toBe(0);
	});

	it("records operator token positions accurately", () => {
		const { project, store } = makeProject();
		const source = [
			'import { Vec2 } from "./Vec2";',
			"const a = new Vec2(1, 2);",
			"const b = new Vec2(3, 4);",
			"const c = a + b;",
		].join("\n");
		const usageFile = project.createSourceFile("/usage4.ts", source);

		const edits = findOverloadEdits(usageFile, store);

		expect(edits.length).toBe(1);
		const { operatorStart, operatorEnd } = edits[0];
		expect(source.slice(operatorStart, operatorEnd)).toBe("+");
	});

	it("records classFilePath matching the source file path", () => {
		const { project, store } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage5.ts",
			[
				'import { Vec2 } from "./Vec2";',
				"const a = new Vec2(1, 2);",
				"const b = new Vec2(3, 4);",
				"const c = a + b;",
			].join("\n"),
		);

		const edits = findOverloadEdits(usageFile, store);

		expect(edits.length).toBe(1);
		expect(edits[0].classFilePath).toBe("/Vec2.ts");
	});
});

// ----- getOverloadHoverInfo -----

describe("getOverloadHoverInfo", () => {
	it("returns display parts for a binary static overload", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 10,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "+",
			returnType: "Vec2",
			lhsType: "Vec2",
			rhsType: "Vec2",
			isStatic: true,
			kind: "binary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result).toBeDefined();
		const joined = result!.displayParts.map((p) => p.text).join("");
		expect(joined).toBe("Vec2 + Vec2 = Vec2");
	});

	it("strips import() prefixes from type names in display parts", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 10,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "+",
			returnType: 'import("/Vec2").Vec2',
			lhsType: 'import("/Vec2").Vec2',
			rhsType: 'import("/Vec2").Vec2',
			isStatic: true,
			kind: "binary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result).toBeDefined();
		const joined = result!.displayParts.map((p) => p.text).join("");
		expect(joined).not.toContain("import(");
		expect(joined).toContain("Vec2");
	});

	it("extracts JSDoc from the first overload signature", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 10,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "+",
			returnType: "Vec2",
			lhsType: "Vec2",
			rhsType: "Vec2",
			isStatic: true,
			kind: "binary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result).toBeDefined();
		expect(result!.documentation).toBeDefined();
		expect(result!.documentation![0].text).toContain("Adds two vectors");
	});

	it("returns a result without documentation when the class file is not in the project", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 10,
			className: "Vec2",
			classFilePath: "/DoesNotExist.ts",
			operatorString: "+",
			returnType: "Vec2",
			lhsType: "Vec2",
			rhsType: "Vec2",
			isStatic: true,
			kind: "binary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		// No class source file → no JSDoc, but display parts still built from edit fields
		expect(result).toBeDefined();
		expect(result!.documentation).toBeUndefined();
		const joined = result!.displayParts.map((p) => p.text).join("");
		expect(joined).toContain("+");
	});

	it("builds prefix unary display parts as 'op operand = return'", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 6,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "-",
			returnType: "Vec2",
			operandType: "Vec2",
			isStatic: true,
			kind: "prefixUnary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result).toBeDefined();
		const parts = result!.displayParts;
		expect(parts[0].text).toBe("-");
		expect(parts[1].text).toBe("Vec2");
	});

	it("builds postfix unary display parts as 'className op'", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 5,
			operatorEnd: 7,
			hoverStart: 5,
			hoverEnd: 7,
			exprStart: 0,
			exprEnd: 7,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "++",
			returnType: "Vec2",
			operandType: "Vec2",
			isStatic: true,
			kind: "postfixUnary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result).toBeDefined();
		const parts = result!.displayParts;
		expect(parts[0].text).toBe("Vec2");
		expect(parts[1].text).toBe("++");
	});

	it("sets kindModifiers to 'static' for static overloads", () => {
		const { project } = makeProject();
		const edit = {
			operatorStart: 0,
			operatorEnd: 1,
			hoverStart: 0,
			hoverEnd: 1,
			exprStart: 0,
			exprEnd: 10,
			className: "Vec2",
			classFilePath: "/Vec2.ts",
			operatorString: "+",
			returnType: "Vec2",
			lhsType: "Vec2",
			rhsType: "Vec2",
			isStatic: true,
			kind: "binary" as const,
		};

		const result = getOverloadHoverInfo(mockTs, project, edit);

		expect(result!.kindModifiers).toBe("static");
	});
});
