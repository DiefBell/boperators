import * as path from "path";
import {
	Project,
	Node,
	type ClassDeclaration,
	type FunctionExpression,
	type ArrowFunction,
	type FunctionDeclaration,
	SyntaxKind,
	type Symbol as AstSymbol,
} from "ts-morph";
import { LIB_ROOT, OPERATOR_SYMBOLS_FILE } from "./consts";
import { operatorMap, type OperatorName, type OperatorSyntaxKind } from "./operatorMap";

type OverloadFunction =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression;

const testFilePath = path.join(process.cwd(), "test", "test.ts");

// Initialise the ts-morph project
const project = new Project();
project.addSourceFilesAtPaths([OPERATOR_SYMBOLS_FILE, LIB_ROOT, testFilePath]);

// A set of operator symbols for quick checks
const operatorSymbolsFile = project.getSourceFile(OPERATOR_SYMBOLS_FILE);
const operatorSymbols = new Map<AstSymbol, OperatorSyntaxKind>(
	operatorSymbolsFile!
		.getVariableDeclarations()
		.filter((decl) => decl.getInitializer()?.getText().startsWith("Symbol"))
		.filter((decl) => decl.getNameNode().isKind(SyntaxKind.Identifier) && !!decl.getNameNode().getSymbol())
		.map((decl) => [decl.getNameNode().getSymbol()!, operatorMap[decl.getName() as OperatorName]])
);

// Load test file
const testFile = project.getSourceFileOrThrow(testFilePath);

type TypeName = string;

// Map to store results
const overloads = new Map<OperatorSyntaxKind, Map<ClassDeclaration, Map<TypeName, OverloadFunction>>>();
for (const operatorSyntaxKind of Object.values(operatorMap))
{
	overloads.set(operatorSyntaxKind, new Map());
}

// Find all classes in the file
const classes = testFile.getClasses();

classes.forEach((classDecl) =>
{
	// Iterate through class properties
	classDecl.getInstanceProperties().forEach((property) =>
	{
		const propertyName = property.getName();

		if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations

		const nameNode = property.getNameNode();
		if (!nameNode.isKind(SyntaxKind.ComputedPropertyName)) return;

		const expression = nameNode.getExpression();

		let symbol: AstSymbol | undefined;
		if (expression.isKind(SyntaxKind.Identifier)) // e.g. [PLUS]
		{
			symbol = expression.getSymbol();
		}
		else if (expression.isKind(SyntaxKind.PropertyAccessExpression)) // e.g. [ops.MULTIPLY]
		{
			const propNameNode = expression.getNameNode();

			if (!Node.isIdentifier(propNameNode)) return;
			symbol = propNameNode.getSymbol();
		}
		else
		{
			return;
		}
		if (!symbol) return;

		/**
		 * If this symbol aliases another one, resolve that.
		 * This can occur when using an deconstructing import statement,
		 * e.g. `import { PLUS } from "boperators";`
		 */
		symbol = symbol.getAliasedSymbol() ?? symbol;

		const syntaxKind = operatorSymbols.get(symbol);
		if (!syntaxKind) return; // means it's not one of our operator Symbols

		const initializer = property.getInitializer();
		if (!initializer || !Node.isArrayLiteralExpression(initializer)) return; // Ensure it's an array initializer

		initializer.getElements().forEach((element) =>
		{
			// Explicitly check for function-like node kinds
			if (
				!element.isKind(SyntaxKind.ArrowFunction)
				&& !element.isKind(SyntaxKind.FunctionExpression)
				&& !element.isKind(SyntaxKind.FunctionDeclaration)
			)
			{
				return; // Skip non-function nodes
			}

			const parameter = element.getParameters()[0];
			if (!parameter)
				throw new Error(`Function ${element.getText()} has no parameters`);

			const operatorOverloads = overloads.get(syntaxKind) ?? new Map<ClassDeclaration, Map<TypeName, OverloadFunction>>();
			const classOverloads = operatorOverloads.get(classDecl) ?? new Map<TypeName, OverloadFunction>();

			// Get the parameter type
			const paramType = parameter.getType().getText();
			if (classOverloads.has(paramType))
			{
				throw new Error(
					`Duplicate function with parameter type '${paramType}' for symbol '${propertyName}'`
				);
			}

			classOverloads.set(paramType, element);
			operatorOverloads.set(classDecl, classOverloads);
			overloads.set(syntaxKind, operatorOverloads);
		});
	});
});

console.log("\n"); // padding
for (const [operatorSyntaxKind, classMap] of overloads)
{
	for (const [classDecl, typeMap] of classMap)
	{
		console.log(`Operator: ${SyntaxKind[operatorSyntaxKind]}`);
		console.log(`  Class: ${classDecl.getName()}`);
		for (const [type, overload] of typeMap)
		{
			console.log(`    Type: ${type}`);
			console.log(`      Overload: ${overload.getText().replaceAll("\n", " ")}`);
		}
	}
}

console.log("\n"); // padding
