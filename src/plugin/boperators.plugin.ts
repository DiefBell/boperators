import { plugin, type BunPlugin, type PluginBuilder } from "bun";
import { Project as TsMorphProject } from "ts-morph";
import { ErrorManager } from "../core/ErrorManager";
import { OverloadStore } from "../core/OverloadStore";
import { OverloadInjector } from "../core/OverloadInjector";

const boperatorsPlugin: BunPlugin = {
	name: "boperators",
	target: "bun",
	setup(build: PluginBuilder)
	{
		// We'll manually get dependencies because then ts-morph returns a nice list of them!
		const project = new TsMorphProject({ skipFileDependencyResolution: true });
		const errorManager = new ErrorManager(false /* Eventually use plugin factory for this??? */);
		const overloadStore = new OverloadStore(project, errorManager);
		const overloadInjector = new OverloadInjector(project, overloadStore);

		build.onLoad({ filter: /\.ts$/ }, async (args) =>
		{
			project.addSourceFileAtPath(args.path);
			const dependencies = project.resolveSourceFileDependencies();

			dependencies.forEach((depSourceFile) =>
			{
				console.log(depSourceFile.getFilePath());
				overloadStore.addOverloadsFromFile(depSourceFile);
			});
			overloadStore.addOverloadsFromFile(args.path);

			errorManager.throwIfErrorsElseLogWarnings();

			const updatedSourceFile = overloadInjector.overloadFile(args.path);
			overloadInjector.replaceSymbolReferences(updatedSourceFile);

			const contents = updatedSourceFile.getFullText();

			return { contents, loader: "ts" };
		});
	},
};

plugin(boperatorsPlugin);
