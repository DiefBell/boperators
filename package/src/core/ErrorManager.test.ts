import { describe, expect, it, mock } from "bun:test";
import type { BopConfig } from "./BopConfig";
import { ErrorDescription, ErrorManager } from "./ErrorManager";

const silentConfig: BopConfig = {
	errorOnWarning: false,
	logLevel: "silent",
	logger: {
		debug: mock(),
		info: mock(),
		warn: mock(),
		error: mock(),
	},
};

describe("ErrorDescription", () => {
	it("stores errorMessage, filePath, lineNumber, and codeText", () => {
		const desc = new ErrorDescription(
			"Something went wrong",
			"/path/to/file.ts",
			42,
			"const x = y;",
		);
		expect(desc.errorMessage).toBe("Something went wrong");
		expect(desc.filePath).toBe("/path/to/file.ts");
		expect(desc.lineNumber).toBe(42);
		expect(desc.codeText).toBe("const x = y;");
	});

	it("extracts fileName as the basename of filePath", () => {
		const desc = new ErrorDescription(
			"msg",
			"/some/deep/path/file.ts",
			1,
			"code",
		);
		expect(desc.fileName).toBe("file.ts");
	});

	it("formats toString as 'fileName:line: message\\ncode\\n'", () => {
		const desc = new ErrorDescription(
			"Bad syntax",
			"/src/file.ts",
			10,
			"const x =;",
		);
		expect(desc.toString()).toBe("file.ts:10: Bad syntax\nconst x =;\n");
	});
});

describe("ErrorManager", () => {
	it("starts with no warnings or errors", () => {
		const em = new ErrorManager(silentConfig);
		expect(em.getWarningString()).toBe("");
		expect(em.getErrorsString()).toBe("");
	});

	it("addWarning stores a string warning", () => {
		const em = new ErrorManager(silentConfig);
		em.addWarning("watch out");
		expect(em.getWarningString()).toContain("watch out");
	});

	it("addError stores a string error", () => {
		const em = new ErrorManager(silentConfig);
		em.addError("something failed");
		expect(em.getErrorsString()).toContain("something failed");
	});

	it("addWarning stores an ErrorDescription and formats it in getWarningString", () => {
		const em = new ErrorManager(silentConfig);
		em.addWarning(new ErrorDescription("warn msg", "/a/b.ts", 3, "code"));
		expect(em.getWarningString()).toContain("warn msg");
	});

	it("throwIfErrors does not throw when there are only warnings (errorOnWarning: false)", () => {
		const em = new ErrorManager(silentConfig);
		em.addWarning("minor issue");
		expect(() => em.throwIfErrors()).not.toThrow();
	});

	it("throwIfErrors throws when there are errors", () => {
		const em = new ErrorManager(silentConfig);
		em.addError("fatal error");
		expect(() => em.throwIfErrors()).toThrow();
	});

	it("throwIfErrors throws on warnings when errorOnWarning is true", () => {
		const strictConfig: BopConfig = { ...silentConfig, errorOnWarning: true };
		const em = new ErrorManager(strictConfig);
		em.addWarning("strict warning");
		expect(() => em.throwIfErrors()).toThrow();
	});

	it("throwIfErrors does not throw with no errors or warnings", () => {
		const em = new ErrorManager(silentConfig);
		expect(() => em.throwIfErrors()).not.toThrow();
	});

	it("clearWarnings removes all warnings", () => {
		const em = new ErrorManager(silentConfig);
		em.addWarning("warn");
		em.clearWarnings();
		expect(em.getWarningString()).toBe("");
		expect(() => em.throwIfErrors()).not.toThrow();
	});

	it("clearErrors removes all errors", () => {
		const em = new ErrorManager(silentConfig);
		em.addError("err");
		em.clearErrors();
		expect(em.getErrorsString()).toBe("");
		expect(() => em.throwIfErrors()).not.toThrow();
	});

	it("clear removes both errors and warnings", () => {
		const em = new ErrorManager(silentConfig);
		em.addError("err");
		em.addWarning("warn");
		em.clear();
		expect(em.getErrorsString()).toBe("");
		expect(em.getWarningString()).toBe("");
	});

	it("throwIfErrorsElseLogWarnings calls logger.warn when there are warnings but no errors", () => {
		const warnFn = mock();
		const config: BopConfig = {
			...silentConfig,
			logger: { ...silentConfig.logger, warn: warnFn },
		};
		const em = new ErrorManager(config);
		em.addWarning("should be logged");
		expect(() => em.throwIfErrorsElseLogWarnings()).not.toThrow();
		expect(warnFn).toHaveBeenCalled();
	});

	it("throwIfErrorsElseLogWarnings clears warnings by default after logging", () => {
		const em = new ErrorManager(silentConfig);
		em.addWarning("warn");
		em.throwIfErrorsElseLogWarnings();
		expect(em.getWarningString()).toBe("");
	});

	it("throwIfErrorsElseLogWarnings throws when there are errors", () => {
		const em = new ErrorManager(silentConfig);
		em.addError("error");
		em.addWarning("warn");
		expect(() => em.throwIfErrorsElseLogWarnings()).toThrow();
	});
});
