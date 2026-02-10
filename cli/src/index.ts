#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "@commander-js/extra-typings";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
} from "boperators";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = fs.readFileSync(packageJsonPath, "utf-8");
const { version } = JSON.parse(packageJson);

const program = new Command()
	.name("boperate")
	.description("Parse operator overloads and inject them into TS files.")
	.version(version)

	.option(
		"-t, --ts-out <dir>",
		"Output directory for TypeScript files once overloads have been injected.",
	)
	.option(
		"-p, --project <path>",
		"Path to tsconfig.json to use.",
		"tsconfig.json",
	)
	.option(
		"-m, --maps-out <dir>",
		"Output directory for source map files (.map.ts).",
	)
	.option("-d, --dry-run", "Preview only without writing files.", false)
	.option(
		"--error-on-warning",
		"Instead of showing a warning, error on conflicting overloads.",
		false,
	);

program.parse(process.argv);
const options = program.opts();

const tsConfigFilePath = path.isAbsolute(options.project)
	? options.project
	: path.join(process.cwd(), options.project);
if (!fs.existsSync(tsConfigFilePath)) {
	throw new Error(`Unable to find tsconfig file at "${tsConfigFilePath}".`);
}

const config = loadConfig({
	searchDir: path.dirname(tsConfigFilePath),
	overrides: { errorOnWarning: options.errorOnWarning },
});

const project = new TsMorphProject({ tsConfigFilePath });
const errorManager = new ErrorManager(config);
const overloadStore = new OverloadStore(project, errorManager, config.logger);
const overloadInjector = new OverloadInjector(
	project,
	overloadStore,
	config.logger,
);

const allFiles = project.getSourceFiles();

// Only transform and write files within the user's project directory
// ts-morph normalizes paths to forward slashes, so we must match that
const projectDir = `${path.dirname(tsConfigFilePath).replaceAll("\\", "/")}/`;
const projectFiles = allFiles.filter((file) =>
	file.getFilePath().startsWith(projectDir),
);

// Parse ALL files for overload definitions (including library dependencies)
allFiles.forEach((file) => {
	overloadStore.addOverloadsFromFile(file);
});
errorManager.throwIfErrorsElseLogWarnings();

// Only transform files belonging to the user's project
const transformResults = projectFiles.map((file) =>
	overloadInjector.overloadFile(file),
);
errorManager.throwIfErrorsElseLogWarnings();

if (options.dryRun) {
	process.exit(0);
}

if (options.tsOut) {
	const tsOutDir = path.isAbsolute(options.tsOut)
		? options.tsOut
		: path.join(process.cwd(), options.tsOut);
	if (!fs.existsSync(tsOutDir)) {
		fs.mkdirSync(tsOutDir, { recursive: true });
	}

	// Use rootDir from tsconfig (falls back to tsconfig directory)
	const compilerOptions = project.getCompilerOptions();
	const rootDir = compilerOptions.rootDir
		? path.resolve(path.dirname(tsConfigFilePath), compilerOptions.rootDir)
		: path.dirname(tsConfigFilePath);

	transformResults.forEach((result) => {
		const relativePath = path.relative(
			rootDir,
			result.sourceFile.getFilePath(),
		);
		const outPath = path.join(tsOutDir, relativePath);
		const outDir = path.dirname(outPath);
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir, { recursive: true });
		}
		fs.writeFileSync(outPath, result.text);
	});
}

if (options.mapsOut) {
	const mapsOutDir = path.isAbsolute(options.mapsOut)
		? options.mapsOut
		: path.join(process.cwd(), options.mapsOut);
	if (!fs.existsSync(mapsOutDir)) {
		fs.mkdirSync(mapsOutDir, { recursive: true });
	}

	const compilerOptions = project.getCompilerOptions();
	const rootDir = compilerOptions.rootDir
		? path.resolve(path.dirname(tsConfigFilePath), compilerOptions.rootDir)
		: path.dirname(tsConfigFilePath);

	transformResults.forEach((result) => {
		const relativePath = path.relative(
			rootDir,
			result.sourceFile.getFilePath(),
		);
		const mapFileName = relativePath.replace(/\.ts$/, ".map.ts");
		const outPath = path.join(mapsOutDir, mapFileName);
		const outDir = path.dirname(outPath);
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir, { recursive: true });
		}
		fs.writeFileSync(outPath, JSON.stringify(result.sourceMap.edits, null, 2));
	});
}
