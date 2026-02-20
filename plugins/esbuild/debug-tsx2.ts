import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project,
} from "boperators";

const VEC2 = `export class Vec2 {
  x: number; y: number;
  constructor(x: number, y: number) { this.x = x; this.y = y; }
  static readonly "+" = [
    (a: Vec2, b: Vec2): Vec2 => new Vec2(a.x + b.x, a.y + b.y),
  ] as const;
}`;
const USAGE = `import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsx-debug2-"));
fs.writeFileSync(
	path.join(tmpDir, "tsconfig.json"),
	JSON.stringify({
		compilerOptions: { target: "ES2020", strict: true, jsx: "preserve" },
		include: ["./*.ts", "./*.tsx"],
	}),
);
fs.writeFileSync(path.join(tmpDir, "Vec2.ts"), VEC2);
fs.writeFileSync(path.join(tmpDir, "usage.tsx"), USAGE);

const bopConfig = loadConfig({ searchDir: tmpDir });
const project = new Project({
	tsConfigFilePath: path.join(tmpDir, "tsconfig.json"),
});
const em = new ErrorManager(bopConfig);
const store = new OverloadStore(project, em, bopConfig.logger);
const injector = new OverloadInjector(project, store, bopConfig.logger);

for (const f of project.getSourceFiles()) {
	console.log("File:", f.getFilePath());
	store.addOverloadsFromFile(f);
}

const tsxPath = path.join(tmpDir, "usage.tsx").split("\\").join("/");
const sf = project.getSourceFile(tsxPath);
console.log("Found tsx:", sf?.getFilePath() ?? "NOT FOUND");

if (sf) {
	const original = sf.getFullText();
	const result = injector.overloadFile(sf);
	console.log("Same?", result.text === original);
	console.log("Result:", result.text);
}
fs.rmSync(tmpDir, { recursive: true });
