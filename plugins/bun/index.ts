import { readFileSync } from "node:fs";
import { ErrorManager, OverloadInjector, OverloadStore } from "boperators";
import { type BunPlugin, type PluginBuilder, plugin } from "bun";
import { Project as TsMorphProject } from "ts-morph";

const boperatorsPlugin: BunPlugin = {
	name: "boperators",
	target: "bun",
	setup(build: PluginBuilder) {
		// We'll manually get dependencies because then ts-morph returns a nice list of them!
		const project = new TsMorphProject({ skipFileDependencyResolution: true });
		const errorManager = new ErrorManager(
			false /* Eventually use plugin factory for this??? */,
		);
		const overloadStore = new OverloadStore(project, errorManager);
		const overloadInjector = new OverloadInjector(project, overloadStore);

		build.onLoad({ filter: /\.ts$/ }, async (args) => {
			try {
				project.addSourceFileAtPath(args.path);
				const dependencies = project.resolveSourceFileDependencies();

				for (const depSourceFile of dependencies) {
					overloadStore.addOverloadsFromFile(depSourceFile);
				}
				overloadStore.addOverloadsFromFile(args.path);

				errorManager.throwIfErrorsElseLogWarnings();

				const result = overloadInjector.overloadFile(args.path);

				return { contents: result.text, loader: "ts" };
			} catch (error) {
				console.error(`[boperators] Error transforming ${args.path}:`, error);
				// Return the original file as TypeScript so Bun doesn't
				// fall back to parsing it as JavaScript.
				const originalText = readFileSync(args.path, "utf-8");
				return { contents: originalText, loader: "ts" };
			} finally {
				errorManager.clear();
			}
		});
	},
};

plugin(boperatorsPlugin);
