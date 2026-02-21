import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeCommonSourceDirectory, resolveTsConfig } from "./utils.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

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

const USAGE_SOURCE = `
import { Vec2 } from "./Vec2";
const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
`.trim();

const CLI_PATH = path.join(import.meta.dirname, "index.ts");

function runCLI(args: string[], cwd: string) {
	return Bun.spawnSync(["bun", "run", CLI_PATH, ...args], { cwd });
}

/** Create a minimal boperators project in dir with Vec2 and a usage file. */
function createProject(dir: string) {
	fs.writeFileSync(
		path.join(dir, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ES2020",
				module: "commonjs",
				strict: true,
				rootDir: "./src",
				outDir: "./dist",
			},
			include: ["src"],
		}),
	);
	const srcDir = path.join(dir, "src");
	fs.mkdirSync(srcDir, { recursive: true });
	fs.writeFileSync(path.join(srcDir, "Vec2.ts"), VEC2_SOURCE);
	fs.writeFileSync(path.join(srcDir, "usage.ts"), USAGE_SOURCE);
}

// ─── computeCommonSourceDirectory ────────────────────────────────────────────

describe("computeCommonSourceDirectory", () => {
	it("returns fallback for an empty array", () => {
		expect(computeCommonSourceDirectory([], "/fallback")).toBe("/fallback");
	});

	it("returns the directory of a single file", () => {
		expect(computeCommonSourceDirectory(["/a/b/c.ts"], "/fallback")).toBe(
			"/a/b",
		);
	});

	it("returns the deepest common ancestor directory", () => {
		expect(
			computeCommonSourceDirectory(
				["/a/b/c.ts", "/a/b/d.ts", "/a/b/sub/e.ts"],
				"/fallback",
			),
		).toBe("/a/b");
	});

	it("returns '/' when files share only the root", () => {
		expect(
			computeCommonSourceDirectory(["/a/b/c.ts", "/x/y/z.ts"], "/fallback"),
		).toBe("/");
	});

	it("normalizes backslashes to forward slashes", () => {
		expect(
			computeCommonSourceDirectory(
				["C:\\a\\b\\c.ts", "C:\\a\\b\\d.ts"],
				"/fallback",
			),
		).toBe("C:/a/b");
	});
});

// ─── resolveTsConfig ─────────────────────────────────────────────────────────

describe("resolveTsConfig", () => {
	let tmpDir: string;
	let tsconfigPath: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "boperators-cli-utils-test-"),
		);
		tsconfigPath = path.join(tmpDir, "tsconfig.json");
		fs.writeFileSync(tsconfigPath, "{}");
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns the path as-is for an existing absolute path", () => {
		expect(resolveTsConfig(tsconfigPath)).toBe(tsconfigPath);
	});

	it("resolves a relative path against process.cwd()", () => {
		const original = process.cwd();
		process.chdir(tmpDir);
		try {
			expect(resolveTsConfig("tsconfig.json")).toBe(tsconfigPath);
		} finally {
			process.chdir(original);
		}
	});

	it("throws when the file does not exist", () => {
		expect(() => resolveTsConfig("/nonexistent/path/tsconfig.json")).toThrow(
			'Unable to find tsconfig file at "/nonexistent/path/tsconfig.json".',
		);
	});
});

// ─── compile command ─────────────────────────────────────────────────────────

describe("compile command", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "boperators-cli-compile-test-"),
		);
		createProject(tmpDir);
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("exits 0 on a valid project", () => {
		const { exitCode } = runCLI(["compile", "--no-emit"], tmpDir);
		expect(exitCode).toBe(0);
	});

	it("emits transformed JavaScript", () => {
		const { exitCode } = runCLI(["compile"], tmpDir);
		expect(exitCode).toBe(0);
		const js = fs.readFileSync(path.join(tmpDir, "dist", "usage.js"), "utf-8");
		expect(js).toContain('Vec2["+"][0](a, b)');
	});

	it("writes transformed TypeScript to --ts-out", () => {
		const tsOut = path.join(tmpDir, "ts-out");
		const { exitCode } = runCLI(
			["compile", "--ts-out", tsOut, "--no-emit"],
			tmpDir,
		);
		expect(exitCode).toBe(0);
		const ts = fs.readFileSync(path.join(tsOut, "usage.ts"), "utf-8");
		expect(ts).toContain('Vec2["+"][0](a, b)');
	});

	it("writes source map JSON to --maps-out", () => {
		const mapsOut = path.join(tmpDir, "maps-out");
		const { exitCode } = runCLI(
			["compile", "--maps-out", mapsOut, "--no-emit"],
			tmpDir,
		);
		expect(exitCode).toBe(0);
		const mapPath = path.join(mapsOut, "usage.map.ts");
		expect(fs.existsSync(mapPath)).toBe(true);
		const edits = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
		expect(Array.isArray(edits)).toBe(true);
		expect(edits.length).toBeGreaterThan(0);
	});

	it("does not emit JavaScript with --no-emit", () => {
		const dir = fs.mkdtempSync(
			path.join(os.tmpdir(), "boperators-cli-noemit-test-"),
		);
		createProject(dir);
		try {
			runCLI(["compile", "--no-emit"], dir);
			expect(fs.existsSync(path.join(dir, "dist"))).toBe(false);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("exits with a non-zero code when tsconfig is not found", () => {
		const { exitCode } = runCLI(
			["compile", "--project", "nonexistent.json"],
			tmpDir,
		);
		expect(exitCode).not.toBe(0);
	});
});

// ─── validate command ─────────────────────────────────────────────────────────

describe("validate command - exported class", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "boperators-cli-validate-test-"),
		);
		fs.writeFileSync(
			path.join(tmpDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2020", strict: true },
				include: ["*.ts"],
			}),
		);
		fs.writeFileSync(path.join(tmpDir, "Vec2.ts"), VEC2_SOURCE);
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("exits 0 and prints a success message", () => {
		const { exitCode, stdout } = runCLI(["validate"], tmpDir);
		expect(exitCode).toBe(0);
		expect(new TextDecoder().decode(stdout)).toContain(
			"All overload classes are properly exported",
		);
	});
});

describe("validate command - unexported class", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(
			path.join(os.tmpdir(), "boperators-cli-validate-test-"),
		);
		fs.writeFileSync(
			path.join(tmpDir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: { target: "ES2020", strict: true },
				include: ["*.ts"],
			}),
		);
		// Vec2 is intentionally NOT exported — this triggers a violation
		fs.writeFileSync(
			path.join(tmpDir, "Vec2.ts"),
			VEC2_SOURCE.replace("export class Vec2", "class Vec2"),
		);
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("exits 1 and prints an error", () => {
		const { exitCode, stderr } = runCLI(["validate"], tmpDir);
		expect(exitCode).toBe(1);
		expect(new TextDecoder().decode(stderr)).toContain("ERROR");
	});

	it("exits 0 and prints a warning with --warn", () => {
		const { exitCode, stderr } = runCLI(["validate", "--warn"], tmpDir);
		expect(exitCode).toBe(0);
		expect(new TextDecoder().decode(stderr)).toContain("WARNING");
	});
});
