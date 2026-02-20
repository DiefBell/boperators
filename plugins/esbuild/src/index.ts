import path from "node:path";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
} from "boperators";
import type { Plugin } from "esbuild";

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

export interface BoperatorsPluginOptions {
	/** Path to tsconfig.json, relative to absWorkingDir (or process.cwd()). Defaults to "tsconfig.json". */
	project?: string;
	/** RegExp filter for files to transform. Defaults to /\.tsx?$/. */
	include?: RegExp;
}

export function boperators(options: BoperatorsPluginOptions = {}): Plugin {
	const include = options.include ?? /\.tsx?$/;

	return {
		name: "boperators",
		setup(build) {
			const workDir = build.initialOptions.absWorkingDir ?? process.cwd();

			const tsconfigPath = options.project
				? path.resolve(workDir, options.project)
				: path.join(workDir, "tsconfig.json");

			const bopConfig = loadConfig({ searchDir: path.dirname(tsconfigPath) });

			const tsMorphProject = new TsMorphProject({
				tsConfigFilePath: tsconfigPath,
			});

			const errorManager = new ErrorManager(bopConfig);
			const overloadStore = new OverloadStore(
				tsMorphProject,
				errorManager,
				bopConfig.logger,
			);
			const overloadInjector = new OverloadInjector(
				tsMorphProject,
				overloadStore,
				bopConfig.logger,
			);

			// Scan all project files for overload definitions upfront
			const allFiles = tsMorphProject.getSourceFiles();
			for (const file of allFiles) {
				overloadStore.addOverloadsFromFile(file);
			}

			errorManager.throwIfErrorsElseLogWarnings();

			build.onLoad({ filter: include }, (args) => {
				try {
					const normalizedPath = normalizePath(args.path);

					const sourceFile = tsMorphProject.getSourceFile(normalizedPath);
					if (!sourceFile) return null;

					const originalText = sourceFile.getFullText();
					const result = overloadInjector.overloadFile(sourceFile);

					if (result.text === originalText) return null;

					// Preserve the original loader so esbuild handles JSX correctly
					const loader = args.path.endsWith(".tsx") ? "tsx" : "ts";

					return { contents: result.text, loader };
				} catch (error) {
					bopConfig.logger.error(`Error transforming ${args.path}: ${error}`);
					return null;
				}
			});
		},
	};
}

export default boperators;
