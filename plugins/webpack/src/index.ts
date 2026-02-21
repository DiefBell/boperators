import path from "node:path";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
	toV3SourceMap,
} from "boperators";
import type { LoaderDefinitionFunction } from "webpack";

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

interface BoperatorsLoaderOptions {
	project?: string; // path to tsconfig.json
	errorOnWarning?: boolean;
}

const loader: LoaderDefinitionFunction<BoperatorsLoaderOptions> = function (
	source,
	_map,
) {
	const callback = this.async();
	if (!callback) return;

	try {
		const resourcePath = normalizePath(this.resourcePath);

		// Resolve tsconfig path: explicit option, or default to rootContext/tsconfig.json
		const projectOption = this.getOptions()?.project;
		const tsconfigPath = projectOption
			? path.resolve(this.rootContext, projectOption)
			: path.join(this.rootContext, "tsconfig.json");

		const bopConfig = loadConfig({
			searchDir: path.dirname(tsconfigPath),
		});

		// Create ts-morph project from tsconfig
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

		// Parse all files for overload definitions
		const allFiles = tsMorphProject.getSourceFiles();
		for (const file of allFiles) {
			overloadStore.addOverloadsFromFile(file);
		}

		errorManager.throwIfErrorsElseLogWarnings();

		// Only transform this file
		const sourceFile = tsMorphProject.getSourceFile(resourcePath);
		if (!sourceFile) {
			return callback(null, source, null);
		}

		const originalText = sourceFile.getFullText();
		const result = overloadInjector.overloadFile(sourceFile);

		if (result.text === originalText) {
			return callback(null, source, null);
		}

		const sourceMap = toV3SourceMap(
			result.edits,
			originalText,
			result.text,
			resourcePath,
		);

		return callback(null, result.text, sourceMap);
	} catch (err) {
		callback(err as Error);
	}
};

export default loader;
