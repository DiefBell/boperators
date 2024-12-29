import {
	type ArrowFunction,
	type FunctionDeclaration,
	type FunctionExpression,
	type Project as TsMorphProject,
	type Symbol as AstSymbol,
	SyntaxKind,
	Node,
} from "ts-morph";
import { operatorMap, type OperatorName, type OperatorSyntaxKind } from "./operatorMap";
import * as path from "path";

export const LIB_ROOT = path.join(
	import.meta.dir, // consts
	"..", // src
	"lib"
);

export const OPERATOR_SYMBOLS_FILE = path.join(LIB_ROOT, "operatorSymbols.ts");

type LhsTypeName = string;
type RhsTypeName = string;
type OverloadFunction =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression;

export class OverloadStore extends Map<
	OperatorSyntaxKind,
	Map<LhsTypeName, Map<RhsTypeName, OverloadFunction>>
>
{
	constructor(project: TsMorphProject)
	{
		super();

		project.addSourceFileAtPath(OPERATOR_SYMBOLS_FILE);
		const operatorSymbolsFile = project.getSourceFile(OPERATOR_SYMBOLS_FILE);
		const operatorSymbols = new Map<AstSymbol, OperatorSyntaxKind>(
			operatorSymbolsFile!
				.getVariableDeclarations()
				.filter((decl) => decl.getInitializer()?.getText().startsWith("Symbol"))
				.filter(
					(decl) =>
						decl.getNameNode().isKind(SyntaxKind.Identifier)
						&& !!decl.getNameNode().getSymbol()
				)
				.map((decl) => [
					decl.getNameNode().getSymbol()!,
					operatorMap[decl.getName() as OperatorName],
				])
		);

		const classes = project.getSourceFiles().flatMap((file) => file.getClasses());

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

					const operatorOverloads = this.get(syntaxKind) ?? new Map<LhsTypeName, Map<RhsTypeName, OverloadFunction>>();
					const lhsMap = operatorOverloads.get(lhsType) ?? new Map<RhsTypeName, OverloadFunction>();

					if (lhsMap.has(rhsType))
					{
						throw new Error(
							`Duplicate overload for operator ${SyntaxKind[syntaxKind]} with LHS type ${lhsType} and RHS type ${rhsType}`
						);
					}

					lhsMap.set(rhsType, element);
					operatorOverloads.set(lhsType, lhsMap);
					this.set(syntaxKind, operatorOverloads);
				});
			});

			// Iterate through instance properties
			classDecl.getInstanceProperties().forEach((property) =>
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
					if (parameters.length < 1)
					{
						throw new Error(
							`Instance function ${element.getText()} must have at least one parameter.`
						);
					}

					const rhsType = parameters[0].getType().getText();

					const operatorOverloads = this.get(syntaxKind) ?? new Map<LhsTypeName, Map<RhsTypeName, OverloadFunction>>();
					const lhsMap = operatorOverloads.get(classType) ?? new Map<RhsTypeName, OverloadFunction>();

					if (lhsMap.has(rhsType))
					{
						throw new Error(
							`Duplicate overload for operator ${SyntaxKind[syntaxKind]} with LHS type ${classType} and RHS type ${rhsType}`
						);
					}

					lhsMap.set(rhsType, element);
					operatorOverloads.set(classType, lhsMap);
					this.set(syntaxKind, operatorOverloads);
				});
			});
		});
	}

	public override toString()
	{
		let str = "";
		for (const [operatorSyntaxKind, lhsMap] of this)
		{
			str += `\n\nOperator: ${SyntaxKind[operatorSyntaxKind]}`;
			for (const [lhsType, rhsMap] of lhsMap)
			{
				str += `\n  - LHS Type: ${lhsType}`;
				for (const [rhsType, overload] of rhsMap)
				{
					str += `\n      - RHS Type: ${rhsType}`;
					str += `\n          Overload: ${
						overload.getText()
							.replace(/(\r\n|\n|\r)/g, " ")
							.replace(/\s+/g, " ")
					}`;
				}
			}
		}
		return str;
	}
}
