import path from "node:path";
import {
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
} from "boperators";
import type ts from "typescript";

// ts-patch types (defined inline for version independence)

interface PluginConfig {
	[x: string]: unknown;
	transform?: string;
	transformProgram?: boolean;
	errorOnWarning?: boolean;
}

interface ProgramTransformerExtras {
	ts: typeof ts;
}

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/");
}

const transformer = (
	program: ts.Program,
	host: ts.CompilerHost | undefined,
	config: PluginConfig,
	extras: ProgramTransformerExtras,
): ts.Program => {
	const tsInstance = extras.ts;
	const compilerOptions = program.getCompilerOptions();
	const configFilePath = (compilerOptions as Record<string, unknown>)
		.configFilePath as string | undefined;

	const bopConfig = loadConfig({
		searchDir: configFilePath ? path.dirname(configFilePath) : undefined,
		overrides: { errorOnWarning: config.errorOnWarning },
	});

	if (!configFilePath) {
		bopConfig.logger.warn("No tsconfig path found; skipping transformation.");
		return program;
	}

	try {
		// 1. Create ts-morph project from the same tsconfig
		const tsMorphProject = new TsMorphProject({
			tsConfigFilePath: configFilePath,
		});
		const errorManager = new ErrorManager(bopConfig);
		const overloadStore = new OverloadStore(tsMorphProject, errorManager);
		const overloadInjector = new OverloadInjector(
			tsMorphProject,
			overloadStore,
		);

		// 2. Parse ALL files for overload definitions (including dependencies)
		const allFiles = tsMorphProject.getSourceFiles();
		for (const file of allFiles) {
			overloadStore.addOverloadsFromFile(file);
		}
		errorManager.throwIfErrorsElseLogWarnings();

		// 3. Filter to project files only (same logic as CLI)
		const projectDir = `${normalizePath(path.dirname(configFilePath))}/`;
		const projectFiles = allFiles.filter((file) => {
			const filePath = file.getFilePath();
			if (filePath.endsWith(".d.ts")) return false;
			if (filePath.includes("/node_modules/")) return false;
			return filePath.startsWith(projectDir);
		});

		// 4. Transform project files and collect results
		const transformedTexts = new Map<string, string>();
		for (const file of projectFiles) {
			const originalText = file.getFullText();
			const result = overloadInjector.overloadFile(file);
			if (result.text !== originalText) {
				transformedTexts.set(file.getFilePath(), result.text);
			}
		}
		errorManager.throwIfErrorsElseLogWarnings();

		// 5. Short-circuit if nothing changed
		if (transformedTexts.size === 0) {
			return program;
		}

		// 6. Create proxy CompilerHost that returns transformed source files
		const originalHost = host ?? tsInstance.createCompilerHost(compilerOptions);
		const originalGetSourceFile = originalHost.getSourceFile.bind(originalHost);

		const proxyHost: ts.CompilerHost = {
			...originalHost,
			getSourceFile(
				fileName: string,
				languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
				onError?: (message: string) => void,
				shouldCreateNewSourceFile?: boolean,
			): ts.SourceFile | undefined {
				const normalized = normalizePath(fileName);
				const transformedText = transformedTexts.get(normalized);

				if (transformedText !== undefined) {
					return tsInstance.createSourceFile(
						fileName,
						transformedText,
						languageVersionOrOptions,
					);
				}

				return originalGetSourceFile(
					fileName,
					languageVersionOrOptions,
					onError,
					shouldCreateNewSourceFile,
				);
			},
		};

		// 7. Create and return new program with transformed files
		return tsInstance.createProgram(
			program.getRootFileNames() as string[],
			compilerOptions,
			proxyHost,
		);
	} catch (error) {
		bopConfig.logger.error(`Transformation failed: ${error}`);
		return program;
	}
};

export = transformer;
