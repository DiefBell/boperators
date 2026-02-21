import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BopLogger } from "./BopConfig";
import { loadConfig } from "./BopConfig";

describe("loadConfig", () => {
	let tmpDir: string;
	let subDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bopconf-test-"));
		subDir = path.join(tmpDir, "sub", "dir");
		fs.mkdirSync(subDir, { recursive: true });
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns defaults when no config file exists", () => {
		const config = loadConfig({ searchDir: tmpDir });
		expect(config.errorOnWarning).toBe(false);
		expect(config.logLevel).toBe("info");
	});

	it("reads errorOnWarning and logLevel from .bopconf.json", () => {
		const configPath = path.join(tmpDir, ".bopconf.json");
		fs.writeFileSync(
			configPath,
			JSON.stringify({ errorOnWarning: true, logLevel: "warn" }),
		);
		try {
			const config = loadConfig({ searchDir: tmpDir });
			expect(config.errorOnWarning).toBe(true);
			expect(config.logLevel).toBe("warn");
		} finally {
			fs.unlinkSync(configPath);
		}
	});

	it("finds .bopconf.json by walking up from a subdirectory", () => {
		const configPath = path.join(tmpDir, ".bopconf.json");
		fs.writeFileSync(configPath, JSON.stringify({ logLevel: "debug" }));
		try {
			const config = loadConfig({ searchDir: subDir });
			expect(config.logLevel).toBe("debug");
		} finally {
			fs.unlinkSync(configPath);
		}
	});

	it("applies programmatic overrides on top of file config", () => {
		const configPath = path.join(tmpDir, ".bopconf.json");
		fs.writeFileSync(
			configPath,
			JSON.stringify({ errorOnWarning: true, logLevel: "debug" }),
		);
		try {
			const config = loadConfig({
				searchDir: tmpDir,
				overrides: { logLevel: "error" },
			});
			expect(config.errorOnWarning).toBe(true);
			expect(config.logLevel).toBe("error");
		} finally {
			fs.unlinkSync(configPath);
		}
	});

	it("ignores invalid JSON in .bopconf.json and returns defaults", () => {
		const configPath = path.join(tmpDir, ".bopconf.json");
		fs.writeFileSync(configPath, "not valid json {{ }}");
		try {
			const config = loadConfig({ searchDir: tmpDir });
			expect(config.errorOnWarning).toBe(false);
			expect(config.logLevel).toBe("info");
		} finally {
			fs.unlinkSync(configPath);
		}
	});

	it("uses the provided custom logger", () => {
		const logger: BopLogger = {
			debug: mock(),
			info: mock(),
			warn: mock(),
			error: mock(),
		};
		const config = loadConfig({ searchDir: tmpDir, logger });
		config.logger.warn("hello");
		expect(logger.warn).toHaveBeenCalledWith("hello");
	});

	it("filters debug and info calls when logLevel is 'warn'", () => {
		const logger: BopLogger = {
			debug: mock(),
			info: mock(),
			warn: mock(),
			error: mock(),
		};
		const config = loadConfig({
			searchDir: tmpDir,
			overrides: { logLevel: "warn" },
			logger,
		});
		config.logger.debug("d");
		config.logger.info("i");
		config.logger.warn("w");
		config.logger.error("e");
		expect(logger.debug).not.toHaveBeenCalled();
		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledWith("w");
		expect(logger.error).toHaveBeenCalledWith("e");
	});

	it("passes all log calls through when logLevel is 'debug'", () => {
		const logger: BopLogger = {
			debug: mock(),
			info: mock(),
			warn: mock(),
			error: mock(),
		};
		const config = loadConfig({
			searchDir: tmpDir,
			overrides: { logLevel: "debug" },
			logger,
		});
		config.logger.debug("d");
		config.logger.info("i");
		config.logger.warn("w");
		config.logger.error("e");
		expect(logger.debug).toHaveBeenCalledWith("d");
		expect(logger.info).toHaveBeenCalledWith("i");
		expect(logger.warn).toHaveBeenCalledWith("w");
		expect(logger.error).toHaveBeenCalledWith("e");
	});

	it("silences all log calls when logLevel is 'silent'", () => {
		const logger: BopLogger = {
			debug: mock(),
			info: mock(),
			warn: mock(),
			error: mock(),
		};
		const config = loadConfig({
			searchDir: tmpDir,
			overrides: { logLevel: "silent" },
			logger,
		});
		config.logger.debug("d");
		config.logger.info("i");
		config.logger.warn("w");
		config.logger.error("e");
		expect(logger.debug).not.toHaveBeenCalled();
		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});
});
