import * as path from "path";
import {
	Project,
	Node,
	SyntaxKind,
	type FunctionExpression,
	type ArrowFunction,
	type FunctionDeclaration,
	type Symbol as AstSymbol,
} from "ts-morph";
import { LIB_ROOT, OPERATOR_SYMBOLS_FILE } from "./consts";
import { operatorMap, type OperatorName, type OperatorSyntaxKind } from "./operatorMap";

type OverloadFunction = FunctionDeclaration | ArrowFunction | FunctionExpression;

type TypeName = string;
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

// Map to store results
const overloads = new Map<
	OperatorSyntaxKind,
	Map<
		TypeName, // LHS type
		Map<
			TypeName, // RHS type
			OverloadFunction
		>
	>
>();

// Populate operator map structure
for (const operatorSyntaxKind of Object.values(operatorMap))
{
	overloads.set(operatorSyntaxKind, new Map());
}

// Find all classes in the file
const classes = testFile.getClasses();

classes.forEach((classDecl) =>
{
	const classType = classDecl.getType().getText();

	// Iterate through static properties
	classDecl.getStaticProperties().forEach((property) =>
	{
		if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations

		const nameNode = property.getNameNode();
		if (!nameNode.isKind(SyntaxKind.ComputedPropertyName)) return;

		const expression = nameNode.getExpression();

		let symbol: AstSymbol | undefined;
		if (expression.isKind(SyntaxKind.Identifier))
		{
			symbol = expression.getSymbol();
		}
		else if (expression.isKind(SyntaxKind.PropertyAccessExpression))
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

		// Resolve aliased symbol if necessary
		symbol = symbol.getAliasedSymbol() ?? symbol;

		const syntaxKind = operatorSymbols.get(symbol);
		if (!syntaxKind) return; // Skip if not an operator symbol

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

			const parameters = element.getParameters();
			if (parameters.length < 2)
			{
				throw new Error(
					`Function ${element.getText()} must have at least two parameters for LHS and RHS`
				);
			}

			const lhsType = parameters[0].getType().getText();
			const rhsType = parameters[1].getType().getText();

			if (lhsType !== classType && rhsType !== classType)
			{
				throw new Error(
					`Function ${element.getText()} must have either LHS or RHS matching the class type '${classType}'`
				);
			}

			const operatorOverloads = overloads.get(syntaxKind) ?? new Map<TypeName, Map<TypeName, OverloadFunction>>();
			const lhsMap = operatorOverloads.get(lhsType) ?? new Map<TypeName, OverloadFunction>();

			if (lhsMap.has(rhsType))
			{
				throw new Error(
					`Duplicate overload for operator ${SyntaxKind[syntaxKind]} with LHS type ${lhsType} and RHS type ${rhsType}`
				);
			}

			lhsMap.set(rhsType, element);
			operatorOverloads.set(lhsType, lhsMap);
			overloads.set(syntaxKind, operatorOverloads);
		});
	});

	// Iterate through instance properties
	classDecl.getInstanceProperties().forEach((property) =>
	{
		if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const name = property.getName(); // nice to see in debugger

		const nameNode = property.getNameNode();
		if (!nameNode.isKind(SyntaxKind.ComputedPropertyName)) return;

		const expression = nameNode.getExpression();

		let symbol: AstSymbol | undefined;
		if (expression.isKind(SyntaxKind.Identifier))
		{
			symbol = expression.getSymbol();
		}
		else if (expression.isKind(SyntaxKind.PropertyAccessExpression))
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

		// Resolve aliased symbol if necessary
		symbol = symbol.getAliasedSymbol() ?? symbol;

		const syntaxKind = operatorSymbols.get(symbol);
		if (!syntaxKind) return; // Skip if not an operator symbol

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

			const parameters = element.getParameters();
			if (parameters.length < 1)
			{
				throw new Error(
					`Instance function ${element.getText()} must have at least one parameter.`
				);
			}

			const rhsType = parameters[0].getType().getText();

			const operatorOverloads = overloads.get(syntaxKind) ?? new Map<TypeName, Map<TypeName, OverloadFunction>>();
			const lhsMap = operatorOverloads.get(classType) ?? new Map<TypeName, OverloadFunction>();

			if (lhsMap.has(rhsType))
			{
				throw new Error(
					`Duplicate overload for operator ${SyntaxKind[syntaxKind]} with LHS type ${classType} and RHS type ${rhsType}`
				);
			}

			lhsMap.set(rhsType, element);
			operatorOverloads.set(classType, lhsMap);
			overloads.set(syntaxKind, operatorOverloads);
		});
	});
});

console.log("\n"); // padding
for (const [operatorSyntaxKind, lhsMap] of overloads)
{
	for (const [lhsType, rhsMap] of lhsMap)
	{
		for (const [rhsType, overload] of rhsMap)
		{
			console.log(`Operator: ${SyntaxKind[operatorSyntaxKind]}`);
			console.log(`  LHS Type: ${lhsType}`);
			console.log(`    RHS Type: ${rhsType}`);
			console.log(
				`    Overload: ${overload.getText()
					.replace(/(\r\n|\n|\r)/g, " ")
					.replace(/\s+/g, " ")
				}`
			);
		}
	}
}

console.log("\n"); // padding
