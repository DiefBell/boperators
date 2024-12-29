import * as path from "path";
import {
	Project,
	Node,
	type ClassDeclaration,
	type FunctionExpression,
	type ArrowFunction,
	type FunctionDeclaration,
	SyntaxKind,
	type Identifier,
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
const resultMap = new Map<ClassDeclaration, Map<TypeName, OverloadFunction>>();

// Find all classes in the file
const classes = testFile.getClasses();

classes.forEach((classDecl) =>
{
	const fieldMap = new Map<TypeName, OverloadFunction>();

	// Iterate through class properties
	classDecl.getInstanceProperties().forEach((property) =>
	{
		const propertyName = property.getName();

		if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations

		const nameNode = property.getNameNode();
		if (!nameNode.isKind(SyntaxKind.ComputedPropertyName)) return;

		const expression = nameNode.getExpression();

		let identifier: Identifier;
		if (expression.isKind(SyntaxKind.Identifier)) // e.g. [PLUS]
		{
			identifier = expression;
		}
		else if (expression.isKind(SyntaxKind.PropertyAccessExpression)) // e.g. [ops.MULTIPLY]
		{
			// Get the "name node" part of the PropertyAccessExpression (MULTIPLY)
			const propNameNode = expression.getNameNode(); // This will be the Identifier node for MULTIPLY

			if (!Node.isIdentifier(propNameNode)) return;
			identifier = propNameNode; // Store the identifier (MULTIPLY)
		}
		else
		{
			return;
		}

		const symbol = identifier.getSymbol();
		if (!symbol) return;

		if (!operatorSymbols.has(symbol)) return; // Skip if not an operator symbol

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

			// Get the parameter type
			const paramType = parameter.getType().getText();
			if (fieldMap.has(paramType))
			{
				throw new Error(
					`Duplicate function with parameter type '${paramType}' for symbol '${propertyName}'`
				);
			}

			// Store the function
			fieldMap.set(paramType, element);
		});
	});

	// Store in resultMap
	if (fieldMap.size > 0)
	{
		resultMap.set(classDecl, fieldMap);
	}
});

// Log results
resultMap.forEach((fieldMap, classNode) =>
{
	console.log(`Class: ${classNode.getName()}`);
	fieldMap.forEach((fnNode, argType) =>
	{
		console.log(`  Arg Type: ${argType}, Function: ${fnNode.getText()}`);
	});
});
