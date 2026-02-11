import path from "node:path";
import {
	type BopConfig,
	type BopLogger,
	ErrorManager,
	loadConfig,
	OverloadInjector,
	OverloadStore,
	Project as TsMorphProject,
} from "boperators";

/** Silent logger — MCP servers must not write to stdout. */
const silentLogger: BopLogger = {
	debug: () => {},
	info: () => {},
	warn: (msg) => console.error(`[boperators] [warn] ${msg}`),
	error: (msg) => console.error(`[boperators] [error] ${msg}`),
};

/**
 * Manages a cached boperators project pipeline (Project, OverloadStore,
 * OverloadInjector) for a given tsconfig. Re-initializes when the
 * tsconfig path changes.
 */
export class ProjectManager {
	private _project: TsMorphProject | null = null;
	private _overloadStore: OverloadStore | null = null;
	private _overloadInjector: OverloadInjector | null = null;
	private _config: BopConfig | null = null;
	private _tsConfigPath: string | null = null;
	private _projectDir: string | null = null;

	/**
	 * Initialize or re-initialize the project from a tsconfig path.
	 * No-ops if the same tsconfig is already loaded.
	 */
	initialize(tsConfigPath: string): void {
		const resolved = path.resolve(tsConfigPath);
		if (this._tsConfigPath === resolved && this._project) return;

		this._tsConfigPath = resolved;
		this._projectDir = path.dirname(resolved);

		this._config = loadConfig({
			searchDir: this._projectDir,
			logger: silentLogger,
		});

		this._project = new TsMorphProject({ tsConfigFilePath: resolved });

		const errorManager = new ErrorManager(this._config);
		this._overloadStore = new OverloadStore(
			this._project,
			errorManager,
			this._config.logger,
		);
		this._overloadInjector = new OverloadInjector(
			this._project,
			this._overloadStore,
			this._config.logger,
		);

		// Scan all project files for overload definitions
		for (const file of this._project.getSourceFiles()) {
			this._overloadStore.addOverloadsFromFile(file);
		}
		errorManager.throwIfErrorsElseLogWarnings();
	}

	get project(): TsMorphProject {
		if (!this._project) throw new Error("ProjectManager not initialized");
		return this._project;
	}

	get overloadStore(): OverloadStore {
		if (!this._overloadStore) throw new Error("ProjectManager not initialized");
		return this._overloadStore;
	}

	get overloadInjector(): OverloadInjector {
		if (!this._overloadInjector)
			throw new Error("ProjectManager not initialized");
		return this._overloadInjector;
	}

	get projectDir(): string {
		if (!this._projectDir) throw new Error("ProjectManager not initialized");
		return this._projectDir;
	}
}
