#!/usr/bin/env node

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { operatorSymbols } from "boperators";
import { z } from "zod";
import { ProjectManager } from "./ProjectManager.js";

const server = new McpServer({
	name: "boperators",
	version: "0.1.0",
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
			"Preview the result of boperators transformation on a file. " +
			"Shows the original and transformed text side by side.",
		inputSchema: {
			tsconfig: z
				.string()
				.describe("Absolute path to tsconfig.json for the project."),
			filePath: z
				.string()
				.describe("Absolute path to the TypeScript file to transform."),
		},
	},
	async ({ tsconfig, filePath }) => {
		try {
			projectManager.initialize(tsconfig);

			const sourceFile =
				projectManager.project.getSourceFile(filePath) ??
				projectManager.project.addSourceFileAtPath(filePath);

			const originalText = sourceFile.getFullText();
			const result = projectManager.overloadInjector.overloadFile(sourceFile);

			const changed = result.text !== originalText;
			const transformCount = result.sourceMap.edits.length;

			const output = {
				originalText,
				transformedText: result.text,
				transformCount,
				changed,
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(output, null, 2),
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
