#!/usr/bin/env node

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	type BopLogger,
	ErrorManager,
	loadConfig,
	OverloadStore,
	operatorSymbols,
} from "boperators";
import { z } from "zod";
import { ProjectManager } from "./ProjectManager.js";

const server = new McpServer({
	name: "boperators",
	version: "0.1.3",
});

const projectManager = new ProjectManager();

// ---------- Tool 1: list_overloads ----------

server.registerTool(
	"list_overloads",
	{
		description:
			"List all registered operator overloads in a boperators project. " +
			"Returns class names, operators, parameter types, and whether they are static or instance.",
		inputSchema: {
			tsconfig: z
				.string()
				.describe("Absolute path to tsconfig.json for the project."),
			className: z
				.string()
				.optional()
				.describe("Filter by class name (e.g. 'Vector3')."),
			operator: z
				.string()
				.optional()
				.describe("Filter by operator string (e.g. '+', '+=', '!')."),
		},
	},
	async ({ tsconfig, className, operator }) => {
		try {
			projectManager.initialize(tsconfig);
			let overloads = projectManager.overloadStore.getAllOverloads();

			if (className) {
				overloads = overloads.filter((o) => o.className === className);
			}
			if (operator) {
				overloads = overloads.filter((o) => o.operatorString === operator);
			}

			// Make file paths relative to the project directory
			const projectDir = projectManager.projectDir;
			const result = overloads.map((o) => ({
				kind: o.kind,
				className: o.className,
				operator: o.operatorString,
				index: o.index,
				isStatic: o.isStatic,
				...(o.lhsType !== undefined && { lhsType: o.lhsType }),
				...(o.rhsType !== undefined && { rhsType: o.rhsType }),
				...(o.operandType !== undefined && { operandType: o.operandType }),
				filePath: path.relative(projectDir, o.classFilePath),
			}));

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error listing overloads: ${error}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ---------- Tool 2: transform_preview ----------

server.registerTool(
	"transform_preview",
	{
		description:
			"Preview the result of boperators transformation on a file or a line range within it. " +
			"When startLine/endLine are given, only the relevant slice of original and transformed " +
			"text is returned, keeping token usage low.",
		inputSchema: {
			tsconfig: z
				.string()
				.describe("Absolute path to tsconfig.json for the project."),
			filePath: z
				.string()
				.describe("Absolute path to the TypeScript file to transform."),
			startLine: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe(
					"First line to include (1-based, inclusive). Omit for full file.",
				),
			endLine: z
				.number()
				.int()
				.min(1)
				.optional()
				.describe(
					"Last line to include (1-based, inclusive). Omit for full file.",
				),
		},
	},
	async ({ tsconfig, filePath, startLine, endLine }) => {
		try {
			projectManager.initialize(tsconfig);

			const sourceFile =
				projectManager.project.getSourceFile(filePath) ??
				projectManager.project.addSourceFileAtPath(filePath);

			const originalText = sourceFile.getFullText();
			const result = projectManager.overloadInjector.overloadFile(sourceFile);

			const changed = result.text !== originalText;
			const totalTransformCount = result.sourceMap.edits.length;

			// Full-file mode when no range is specified
			if (startLine === undefined && endLine === undefined) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									originalText,
									transformedText: result.text,
									transformCount: totalTransformCount,
									changed,
								},
								null,
								2,
							),
						},
					],
				};
			}

			// --- Line-range mode ---
			const origLines = originalText.split("\n");
			const rangeStart = Math.max(1, startLine ?? 1);
			const rangeEnd = Math.min(origLines.length, endLine ?? origLines.length);

			// Character offsets for the line range in original text
			let origStartOffset = 0;
			for (let i = 0; i < rangeStart - 1; i++) {
				origStartOffset += origLines[i].length + 1;
			}
			let origEndOffset = origStartOffset;
			for (let i = rangeStart - 1; i < rangeEnd; i++) {
				origEndOffset += origLines[i].length + 1;
			}
			origEndOffset = Math.min(origEndOffset, originalText.length);

			// Map boundaries through the SourceMap to transformed positions
			const transStartOffset =
				result.sourceMap.originalToTransformed(origStartOffset);
			const transEndOffset =
				result.sourceMap.originalToTransformed(origEndOffset);

			// Expand to line boundaries in transformed text
			let transLineStart = transStartOffset;
			while (transLineStart > 0 && result.text[transLineStart - 1] !== "\n") {
				transLineStart--;
			}
			let transLineEnd = transEndOffset;
			while (
				transLineEnd < result.text.length &&
				result.text[transLineEnd] !== "\n"
			) {
				transLineEnd++;
			}

			const originalSlice = origLines
				.slice(rangeStart - 1, rangeEnd)
				.join("\n");
			const transformedSlice = result.text.substring(
				transLineStart,
				transLineEnd,
			);

			// Count edits that overlap with the requested range
			const editsInRange = result.sourceMap.edits.filter(
				(e) => e.origEnd > origStartOffset && e.origStart < origEndOffset,
			).length;

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								startLine: rangeStart,
								endLine: rangeEnd,
								originalText: originalSlice,
								transformedText: transformedSlice,
								transformCount: editsInRange,
								totalTransformCount,
								changed: originalSlice !== transformedSlice,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error transforming file: ${error}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ---------- Tool 3: scaffold_overloads ----------

// Categorize operators for code generation
const instanceOperatorStrings = new Set([
	"+=",
	"-=",
	"*=",
	"**=",
	"/=",
	"%=",
	"&&=",
	"||=",
]);
const comparisonOperatorStrings = new Set([
	">",
	">=",
	"<",
	"<=",
	"==",
	"===",
	"!=",
	"!==",
]);
// Operators that are ONLY prefix unary (not also binary)
const exclusivePrefixUnaryStrings = new Set(["!", "~"]);
const postfixUnaryOperatorStrings = new Set(["++", "--"]);

function generateOverloadProperty(className: string, operator: string): string {
	if (postfixUnaryOperatorStrings.has(operator)) {
		// Postfix unary: instance, no params, returns void
		return [
			`\tpublic readonly "${operator}" = [`,
			`\t\tfunction (this: ${className}): void {`,
			"\t\t\t// TODO: implement",
			"\t\t},",
			"\t] as const;",
		].join("\n");
	}

	if (exclusivePrefixUnaryStrings.has(operator)) {
		// Prefix unary: static, one param (self), returns ClassName
		return [
			`\tpublic static readonly "${operator}" = [`,
			`\t\t(a: ${className}): ${className} => {`,
			"\t\t\t// TODO: implement",
			`\t\t\treturn new ${className}();`,
			"\t\t},",
			"\t] as const;",
		].join("\n");
	}

	if (instanceOperatorStrings.has(operator)) {
		// Instance mutation: instance, one param, returns void
		return [
			`\tpublic readonly "${operator}" = [`,
			`\t\tfunction (this: ${className}, other: ${className}): void {`,
			"\t\t\t// TODO: implement",
			"\t\t},",
			"\t] as const;",
		].join("\n");
	}

	if (comparisonOperatorStrings.has(operator)) {
		// Comparison: static, two params, returns boolean
		return [
			`\tpublic static readonly "${operator}" = [`,
			`\t\t(a: ${className}, b: ${className}): boolean => {`,
			"\t\t\t// TODO: implement",
			"\t\t\treturn false;",
			"\t\t},",
			"\t] as const;",
		].join("\n");
	}

	// Static binary: two params, returns ClassName
	return [
		`\tpublic static readonly "${operator}" = [`,
		`\t\t(a: ${className}, b: ${className}): ${className} => {`,
		"\t\t\t// TODO: implement",
		`\t\t\treturn new ${className}();`,
		"\t\t},",
		"\t] as const;",
	].join("\n");
}

server.registerTool(
	"scaffold_overloads",
	{
		description:
			"Generate TypeScript boilerplate for operator overload definitions on a class. " +
			"Returns code ready to paste into a class body, with correct static/instance " +
			"placement, as const assertions, and this parameters for instance operators.",
		inputSchema: {
			className: z
				.string()
				.describe("The class name to generate overloads for."),
			operators: z
				.array(z.string())
				.describe(
					`Array of operator strings. Valid operators: ${operatorSymbols.join(", ")}`,
				),
		},
	},
	async ({ className, operators }) => {
		const invalid = operators.filter((op) => !operatorSymbols.includes(op));
		if (invalid.length > 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Invalid operator(s): ${invalid.join(", ")}. Valid operators: ${operatorSymbols.join(", ")}`,
					},
				],
				isError: true,
			};
		}

		const properties = operators.map((op) =>
			generateOverloadProperty(className, op),
		);

		const code = properties.join("\n\n");

		return {
			content: [
				{
					type: "text" as const,
					text: code,
				},
			],
		};
	},
);

// ---------- Tool 4: validate_overloads ----------

/** Silent logger that captures warnings into an array. */
function createCapturingLogger(warnings: string[]): BopLogger {
	return {
		debug: () => {},
		info: () => {},
		warn: (msg) => warnings.push(msg),
		error: (msg) => warnings.push(`ERROR: ${msg}`),
	};
}

server.registerTool(
	"validate_overloads",
	{
		description:
			"Validate operator overload definitions in a single file. " +
			"Returns structured diagnostics: errors (wrong arity, bad types, missing as const) " +
			"and warnings (e.g. conflicting overloads). Does not transform the file.",
		inputSchema: {
			tsconfig: z
				.string()
				.describe("Absolute path to tsconfig.json for the project."),
			filePath: z
				.string()
				.describe("Absolute path to the TypeScript file to validate."),
		},
	},
	async ({ tsconfig, filePath }) => {
		try {
			projectManager.initialize(tsconfig);

			const resolvedFile = path.resolve(filePath);
			const sourceFile =
				projectManager.project.getSourceFile(resolvedFile) ??
				projectManager.project.addSourceFileAtPath(resolvedFile);

			// Isolated validation pipeline — captures errors/warnings without
			// affecting the shared ProjectManager state.
			const capturedWarnings: string[] = [];
			const capturingLogger = createCapturingLogger(capturedWarnings);

			const validationConfig = loadConfig({
				searchDir: projectManager.projectDir,
				logger: capturingLogger,
			});

			const errorManager = new ErrorManager(validationConfig);
			const store = new OverloadStore(
				projectManager.project,
				errorManager,
				capturingLogger,
			);

			store.addOverloadsFromFile(sourceFile);

			const errors: string[] = [];
			try {
				errorManager.throwIfErrorsElseLogWarnings();
			} catch (e) {
				errors.push(String(e instanceof Error ? e.message : e));
			}

			const overloads = store.getAllOverloads();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								valid: errors.length === 0 && capturedWarnings.length === 0,
								errors,
								warnings: capturedWarnings,
								overloadCount: overloads.length,
								filePath: path.relative(
									projectManager.projectDir,
									resolvedFile,
								),
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error validating file: ${error}`,
					},
				],
				isError: true,
			};
		}
	},
);

// ---------- Tool 5: explain_expression ----------

/**
 * Regex for instance-style calls:
 *   expr["op"][idx].call(expr, ...)
 * Captures: [1] operator, [2] index
 */
const instanceCallPattern = /\["([^"]+)"\]\[(\d+)\]\.call\(/;

/**
 * Regex for static-style calls:
 *   ClassName["op"][idx](...)
 * Captures: [1] class name, [2] operator, [3] index
 */
const staticCallPattern = /^(\w+)\["([^"]+)"\]\[(\d+)\]\(/;

server.registerTool(
	"explain_expression",
	{
		description:
			"Explain a transformed boperators expression. " +
			'Given an expression like Vector3["+"][0](a, b) or v["++"][0].call(v), ' +
			"identifies the operator kind, class, and overload entry. " +
			"Optionally looks up full overload metadata when tsconfig is provided.",
		inputSchema: {
			expression: z
				.string()
				.describe(
					"The transformed expression to explain, e.g. 'Vector3[\"+\"][0](a, b)'.",
				),
			tsconfig: z
				.string()
				.optional()
				.describe(
					"Absolute path to tsconfig.json. When provided, the overload is looked up " +
						"in the project for richer metadata (file path, parameter types).",
				),
		},
	},
	async ({ expression, tsconfig }) => {
		try {
			const trimmed = expression.trim();

			// Try instance pattern first (has .call)
			const instanceMatch = trimmed.match(instanceCallPattern);
			if (instanceMatch) {
				const [, operator, indexStr] = instanceMatch;
				const index = Number.parseInt(indexStr, 10);

				// Determine if postfix unary (0 args after .call(expr)) or
				// instance binary (.call(expr, rhs))
				const callArgs = trimmed.slice(
					trimmed.indexOf(".call(") + 6,
					trimmed.lastIndexOf(")"),
				);
				const hasSecondArg = callArgs.includes(",");

				const kind = hasSecondArg ? "instance binary" : "postfix unary";
				const originalPattern = hasSecondArg
					? `lhs ${operator} rhs`
					: `operand${operator}`;

				const result: Record<string, unknown> = {
					kind,
					operator,
					index,
					isStatic: false,
					originalExpression: originalPattern,
					explanation: hasSecondArg
						? `Instance binary operator "${operator}": mutates the left-hand side in place (e.g. compound assignment).`
						: `Postfix unary operator "${operator}": mutates the operand in place.`,
				};

				if (tsconfig) {
					const overloadInfo = lookupOverload(tsconfig, operator, index, false);
					if (overloadInfo) Object.assign(result, overloadInfo);
				}

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			// Try static pattern
			const staticMatch = trimmed.match(staticCallPattern);
			if (staticMatch) {
				const [, className, operator, indexStr] = staticMatch;
				const index = Number.parseInt(indexStr, 10);

				// Count args to distinguish binary (2 args) from prefix unary (1 arg)
				const argsStr = trimmed.slice(
					trimmed.indexOf("](") + 2,
					trimmed.lastIndexOf(")"),
				);
				const argCount = argsStr.split(",").length;

				const kind = argCount >= 2 ? "static binary" : "prefix unary";
				const originalPattern =
					argCount >= 2 ? `lhs ${operator} rhs` : `${operator}operand`;

				const result: Record<string, unknown> = {
					kind,
					operator,
					index,
					className,
					isStatic: true,
					originalExpression: originalPattern,
					explanation:
						argCount >= 2
							? `Static binary operator "${operator}": returns a new value from two operands.`
							: `Prefix unary operator "${operator}": returns a new value from a single operand.`,
				};

				if (tsconfig) {
					const overloadInfo = lookupOverload(
						tsconfig,
						operator,
						index,
						true,
						className,
					);
					if (overloadInfo) Object.assign(result, overloadInfo);
				}

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text:
							`Could not parse expression as a boperators transformed call. ` +
							`Expected patterns:\n` +
							`  Static:   ClassName["op"][index](args)\n` +
							`  Instance: expr["op"][index].call(expr, args)`,
					},
				],
				isError: true,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error explaining expression: ${error}`,
					},
				],
				isError: true,
			};
		}
	},
);

/** Look up overload metadata from the project store. */
function lookupOverload(
	tsconfig: string,
	operator: string,
	index: number,
	isStatic: boolean,
	className?: string,
): Record<string, unknown> | null {
	try {
		projectManager.initialize(tsconfig);
		const allOverloads = projectManager.overloadStore.getAllOverloads();

		const match = allOverloads.find((o) => {
			if (o.operatorString !== operator) return false;
			if (o.index !== index) return false;
			if (className && o.className !== className) return false;
			if (o.isStatic !== isStatic) return false;
			return true;
		});

		if (!match) return null;

		return {
			className: match.className,
			filePath: path.relative(projectManager.projectDir, match.classFilePath),
			...(match.lhsType !== undefined && { lhsType: match.lhsType }),
			...(match.rhsType !== undefined && { rhsType: match.rhsType }),
			...(match.operandType !== undefined && {
				operandType: match.operandType,
			}),
		};
	} catch {
		return null;
	}
}

// ---------- Start server ----------

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	// Use stderr — stdout is reserved for JSON-RPC
	console.error("boperators MCP server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
