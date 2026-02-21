import path from "node:path";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
	toV3SourceMap,
} from "boperators";
import type { Plugin, ResolvedConfig } from "vite";

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

export interface BoperatorsPluginOptions {
	/** Path to tsconfig.json, relative to Vite's root. Defaults to "tsconfig.json". */
	project?: string;
	/** RegExp filter for files to transform. Defaults to /\.tsx?$/. */
	include?: RegExp;
}

export function boperators(options: BoperatorsPluginOptions = {}): Plugin {
	const include = options.include ?? /\.tsx?$/;

	let tsMorphProject: TsMorphProject;
	let overloadStore: OverloadStore;
	let overloadInjector: OverloadInjector;

	return {
		name: "boperators",
		enforce: "pre",

		configResolved(config: ResolvedConfig) {
			const root = config.root;
			const tsconfigPath = options.project
				? path.resolve(root, options.project)
				: path.join(root, "tsconfig.json");

			const bopConfig = loadConfig({ searchDir: path.dirname(tsconfigPath) });

			tsMorphProject = new TsMorphProject({ tsConfigFilePath: tsconfigPath });

			const errorManager = new ErrorManager(bopConfig);
			overloadStore = new OverloadStore(
				tsMorphProject,
				errorManager,
				bopConfig.logger,
			);
			overloadInjector = new OverloadInjector(
				tsMorphProject,
				overloadStore,
				bopConfig.logger,
			);

			const allFiles = tsMorphProject.getSourceFiles();
			for (const file of allFiles) {
				overloadStore.addOverloadsFromFile(file);
			}

			errorManager.throwIfErrorsElseLogWarnings();
		},

		transform(code: string, id: string) {
			// Skip virtual modules (Vite's internal convention)
			if (id.startsWith("\0")) return null;

			// Strip Vite query strings (e.g. ?t=123456, ?raw, ?url)
			const cleanId = id.split("?")[0];

			if (!include.test(cleanId)) return null;

			const normalizedId = normalizePath(cleanId);

			const sourceFile = tsMorphProject.getSourceFile(normalizedId);
			if (!sourceFile) return null;

			// Sync ts-morph's in-memory state with Vite's current file content.
			// This ensures HMR edits are picked up without restarting the plugin.
			sourceFile.replaceWithText(code);

			const result = overloadInjector.overloadFile(sourceFile);

			if (result.text === code) return null;

			const map = toV3SourceMap(result.edits, code, result.text, normalizedId);

			return { code: result.text, map };
		},
	};
}

export default boperators;
