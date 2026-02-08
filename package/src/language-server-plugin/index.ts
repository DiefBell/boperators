import tsRuntime from "typescript/lib/tsserverlibrary";
import { Project as TsMorphProject } from "ts-morph";
import { ErrorManager } from "../core/ErrorManager";
import { OverloadStore } from "../core/OverloadStore";
import { OverloadInjector } from "../core/OverloadInjector";

export function init(modules: { typescript: typeof tsRuntime }): tsRuntime.server.PluginModule
{
	const ts = modules.typescript;

	function create(info: tsRuntime.server.PluginCreateInfo): tsRuntime.LanguageService
	{
		const log = (msg: string) => info.project.projectService.logger.info(`[boperators] ${msg}`);
    log("Creating language service plugin for project: " + info.project.getProjectName());
		const host = info.languageServiceHost;

		// Set up ts-morph transformation pipeline (same pattern as the Bun plugin)
		const project = new TsMorphProject({ skipFileDependencyResolution: true });
		const errorManager = new ErrorManager(false);
		const overloadStore = new OverloadStore(project, errorManager);
		const overloadInjector = new OverloadInjector(project, overloadStore);

		const originalGetSnapshot = host.getScriptSnapshot?.bind(host);
		const originalGetVersion = host.getScriptVersion?.bind(host);
		const cache = new Map<string, { version: string; text: string }>();

		host.getScriptSnapshot = (fileName: string) =>
		{
			const snap = originalGetSnapshot?.(fileName);
			if (!snap || !fileName.endsWith(".ts") || fileName.endsWith(".d.ts")) return snap;

			const version = originalGetVersion?.(fileName) ?? "0";
			const cached = cache.get(fileName);
			if (cached?.version === version)
			{
				return ts.ScriptSnapshot.fromString(cached.text);
			}

			const source = snap.getText(0, snap.getLength());

			try
			{
				// Invalidate this file's old overload entries before overwriting.
				// If it previously defined overloads, other files' cached
				// snapshots may reference those stale overloads.
				const hadOverloads = overloadStore.invalidateFile(fileName);
				if (hadOverloads) cache.clear();

				// Add/update the file in our ts-morph project
				project.createSourceFile(fileName, source, { overwrite: true });

				// Resolve any new dependencies and scan for overloads.
				// Only the changed file and newly resolved deps are scanned;
				// other files remain cached in the overload store.
				const deps = project.resolveSourceFileDependencies();
				for (const dep of deps)
					overloadStore.addOverloadsFromFile(dep);
				overloadStore.addOverloadsFromFile(fileName);
				errorManager.throwIfErrorsElseLogWarnings();

				// Transform binary expressions
				const transformed = overloadInjector.overloadFile(fileName);
				const rewritten = transformed.getFullText();

				cache.set(fileName, { version, text: rewritten });
				return ts.ScriptSnapshot.fromString(rewritten);
			}
			catch (e)
			{
				// If transformation fails, return original source untouched
				log(`Error transforming ${fileName}: ${e}`);
				cache.set(fileName, { version, text: source });
				return snap;
			}
		};

		log("Plugin loaded");
		return info.languageService;
	}

	return { create };
}
