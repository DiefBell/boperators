import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE_NAME = ".bopconf.json";

// ----- Types -----

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface BopLogger {
	debug(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
}

export interface BopConfig {
	errorOnWarning: boolean;
	logLevel: LogLevel;
	logger: BopLogger;
}

/**
 * Serialisable subset of {@link BopConfig} — the shape of `.bopconf.json`.
 */
export interface BopConfFile {
	errorOnWarning?: boolean;
	logLevel?: LogLevel;
}

// ----- ConsoleLogger -----

export class ConsoleLogger implements BopLogger {
	debug(msg: string): void {
		console.debug(`[boperators] ${msg}`);
	}
	info(msg: string): void {
		console.log(`[boperators] ${msg}`);
	}
	warn(msg: string): void {
		console.warn(`[boperators] ${msg}`);
	}
	error(msg: string): void {
		console.error(`[boperators] ${msg}`);
	}
}

// ----- Filtered logger -----

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "silent"];

function createFilteredLogger(inner: BopLogger, level: LogLevel): BopLogger {
	const minIndex = LOG_LEVELS.indexOf(level);
	const noop = () => {};
	return {
		debug: minIndex <= 0 ? inner.debug.bind(inner) : noop,
		info: minIndex <= 1 ? inner.info.bind(inner) : noop,
		warn: minIndex <= 2 ? inner.warn.bind(inner) : noop,
		error: minIndex <= 3 ? inner.error.bind(inner) : noop,
	};
}

// ----- Config file discovery -----

function findConfigFile(startDir: string): BopConfFile {
	let dir = path.resolve(startDir);
	while (true) {
		const candidate = path.join(dir, CONFIG_FILE_NAME);
		try {
			const content = fs.readFileSync(candidate, "utf-8");
			return JSON.parse(content) as BopConfFile;
		} catch {
			// File not found or invalid JSON — keep walking up
		}
		const parent = path.dirname(dir);
		if (parent === dir) break; // filesystem root
		dir = parent;
	}
	return {};
}

// ----- loadConfig -----

export interface LoadConfigOptions {
	/** Directory to start searching for `.bopconf.json` (default: `process.cwd()`). */
	searchDir?: string;
	/** Programmatic overrides applied on top of file config (e.g. CLI flags, plugin config). */
	overrides?: Partial<BopConfFile>;
	/** Custom logger implementation (e.g. TS language server logger). */
	logger?: BopLogger;
}

const DEFAULTS: Required<BopConfFile> = {
	errorOnWarning: false,
	logLevel: "info",
};

export function loadConfig(options?: LoadConfigOptions): BopConfig {
	const fileConfig = findConfigFile(options?.searchDir ?? process.cwd());
	const merged = { ...DEFAULTS, ...fileConfig, ...options?.overrides };
	const baseLogger = options?.logger ?? new ConsoleLogger();
	const logger = createFilteredLogger(baseLogger, merged.logLevel);
	return {
		errorOnWarning: merged.errorOnWarning,
		logLevel: merged.logLevel,
		logger,
	};
}
