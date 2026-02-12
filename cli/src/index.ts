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
	validateExports,
} from "boperators";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = fs.readFileSync(packageJsonPath, "utf-8");
const { version } = JSON.parse(packageJson);

/** Resolve tsconfig path relative to cwd if not absolute. */
function resolveTsConfig(project: string): string {
	const p = path.isAbsolute(project)
		? project
		: path.join(process.cwd(), project);
	if (!fs.existsSync(p)) {
		throw new Error(`Unable to find tsconfig file at "${p}".`);
	}
	return p;
}

/**
 * Compute the common ancestor directory of a set of file paths — this matches
 * what TypeScript does when `rootDir` is not specified in tsconfig.
 */
function computeCommonSourceDirectory(
	filePaths: string[],
	fallback: string,
): string {
	if (filePaths.length === 0) return fallback;
	const dirs = filePaths.map((p) => path.dirname(p.replaceAll("\\", "/")));
	const segments = dirs.map((d) => d.split("/"));
	const first = segments[0];
	let commonLength = first.length;
	for (const seg of segments.slice(1)) {
		let i = 0;
		while (i < commonLength && i < seg.length && first[i] === seg[i]) {
			i++;
		}
		commonLength = i;
	}
	return first.slice(0, commonLength).join("/") || "/";
}

const program = new Command()
	.name("boperate")
	.description(
		"Parse operator overloads and inject them into TypeScript files.",
	)
	.version(version);

// ---------- compile ----------

program
	.command("compile")
	.description("Transform TypeScript files with operator overloads injected.")
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
	)
	.action((options) => {
		const tsConfigFilePath = resolveTsConfig(options.project);

		const config = loadConfig({
			searchDir: path.dirname(tsConfigFilePath),
			overrides: { errorOnWarning: options.errorOnWarning },
		});

		const project = new TsMorphProject({ tsConfigFilePath });
		const errorManager = new ErrorManager(config);
		const overloadStore = new OverloadStore(
			project,
			errorManager,
			config.logger,
		);
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

			const compilerOptions = project.getCompilerOptions();
			const rootDir = compilerOptions.rootDir
				? path.resolve(path.dirname(tsConfigFilePath), compilerOptions.rootDir)
				: computeCommonSourceDirectory(
						projectFiles.map((f) => f.getFilePath()),
						path.dirname(tsConfigFilePath),
					);

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
				: computeCommonSourceDirectory(
						projectFiles.map((f) => f.getFilePath()),
						path.dirname(tsConfigFilePath),
					);

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
				fs.writeFileSync(
					outPath,
					JSON.stringify(result.sourceMap.edits, null, 2),
				);
			});
		}
	});

// ---------- validate ----------

program
	.command("validate")
	.description(
		"Validate that all classes with operator overloads are properly exported. " +
			"Intended for library authors to run before publishing.",
	)
	.option(
		"-p, --project <path>",
		"Path to tsconfig.json to use.",
		"tsconfig.json",
	)
	.option(
		"--entry <path>",
		"Source entry point for deep reachability check (e.g. src/index.ts). " +
			"When provided, validates that every overload class is transitively " +
			"reachable via the entry file's export graph.",
	)
	.option(
		"--warn",
		"Emit warnings instead of exiting with an error on violations.",
		false,
	)
	.action((options) => {
		const tsConfigFilePath = resolveTsConfig(options.project);
		const projectDir = path.dirname(tsConfigFilePath);

		const config = loadConfig({ searchDir: projectDir });
		const project = new TsMorphProject({ tsConfigFilePath });
		const errorManager = new ErrorManager(config);
		const overloadStore = new OverloadStore(
			project,
			errorManager,
			config.logger,
		);

		// Scan all files for overload definitions
		project.getSourceFiles().forEach((file) => {
			overloadStore.addOverloadsFromFile(file);
		});

		const entryPoint = options.entry
			? path.isAbsolute(options.entry)
				? options.entry
				: path.join(process.cwd(), options.entry)
			: undefined;

		const result = validateExports({
			project,
			overloadStore,
			projectDir,
			entryPoint,
		});

		if (result.violations.length === 0) {
			console.log("[boperators] All overload classes are properly exported.");
			process.exit(0);
		}

		for (const violation of result.violations) {
			const relPath = path.relative(projectDir, violation.classFilePath);
			const message =
				violation.reason === "not-exported-from-file"
					? `${violation.className} (${relPath}): not exported from its source file — add 'export' to the class declaration`
					: `${violation.className} (${relPath}): not reachable from entry point — ensure it is re-exported from ${options.entry}`;

			if (options.warn) {
				console.warn(`[boperators] WARNING: ${message}`);
			} else {
				console.error(`[boperators] ERROR: ${message}`);
			}
		}

		if (!options.warn) {
			process.exit(1);
		}
	});

program.parse(process.argv);
