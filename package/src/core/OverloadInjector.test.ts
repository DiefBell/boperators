import { describe, expect, it, mock } from "bun:test";
import { Project } from "ts-morph";
import type { BopConfig } from "./BopConfig";
import { ErrorManager } from "./ErrorManager";
import { OverloadInjector } from "./OverloadInjector";
import { OverloadStore } from "./OverloadStore";

// A minimal in-memory Vec2 class with a static "+" overload
const VEC2_SOURCE = `
export class Vec2 {
	x: number;
	y: number;
	constructor(x: number, y: number) { this.x = x; this.y = y; }
	static readonly "+" = [
		(a: Vec2, b: Vec2): Vec2 => new Vec2(a.x + b.x, a.y + b.y),
	] as const;
	static readonly "-" = [
		(a: Vec2, b: Vec2): Vec2 => new Vec2(a.x - b.x, a.y - b.y),
	] as const;
}
`.trim();

const silentConfig: BopConfig = {
	errorOnWarning: false,
	logLevel: "silent",
	logger: { debug: mock(), info: mock(), warn: mock(), error: mock() },
};

function makeProject() {
	const project = new Project({ useInMemoryFileSystem: true });
	const vec2File = project.createSourceFile("/Vec2.ts", VEC2_SOURCE);

	const errorManager = new ErrorManager(silentConfig);
	const store = new OverloadStore(project, errorManager, silentConfig.logger);
	store.addOverloadsFromFile(vec2File);

	const injector = new OverloadInjector(project, store, silentConfig.logger);
	return { project, store, injector, errorManager };
}

describe("OverloadInjector.overloadFile", () => {
	it("transforms a binary overloaded expression", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage.ts",
			`
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.text).toContain('Vec2["+"][0](a, b)');
	});

	it("produces non-empty edits when a transformation occurs", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage2.ts",
			`
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.edits.length).toBeGreaterThan(0);
	});

	it("does not transform expressions with no matching overload", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage3.ts",
			"const x = 1 + 2;",
		);

		const result = injector.overloadFile(usageFile);
		expect(result.text).toContain("1 + 2");
		expect(result.edits.length).toBe(0);
	});

	it("transforms multiple binary expressions in one file", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage4.ts",
			`
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = new Vec2(5, 6);
const d = a + b;
const e = b + c;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.text.match(/Vec2\["\+"\]\[0\]/g)?.length).toBe(2);
	});

	it("transforms different operators independently", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage5.ts",
			`
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const sum = a + b;
const diff = a - b;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.text).toContain('Vec2["+"][0](a, b)');
		expect(result.text).toContain('Vec2["-"][0](a, b)');
	});

	it("returns the same SourceFile reference as the input", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage6.ts",
			`
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.sourceFile).toBe(usageFile);
	});

	it("returns empty edits when no overloaded operators are present", () => {
		const { project, injector } = makeProject();
		const usageFile = project.createSourceFile(
			"/usage7.ts",
			`
const x = "hello" + " world";
const y = 1 + 2 + 3;
`.trim(),
		);

		const result = injector.overloadFile(usageFile);
		expect(result.edits.length).toBe(0);
	});
});
