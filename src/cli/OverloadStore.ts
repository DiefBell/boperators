import {
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
type OverloadDescription = {
	isStatic: boolean;
	className: string;
	propName: string;
	index: number;
};

export class OverloadStore extends Map<
	OperatorSyntaxKind,
	Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>
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
			classDecl.getProperties().forEach((property) =>
			{
				if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations

				const isStatic = property.isStatic();

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

				initializer.getElements().forEach((element, index) =>
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
					if (isStatic)
					{
						if (parameters.length !== 2)
						{
							throw new Error(
								`Function ${element.getText()} must have two parameters for LHS and RHS`
							);
						}
					}
					else
					{
						if (parameters.length !== 1)
						{
							throw new Error(
								`Function ${element.getText()} must have one parameter for RHS`
							);
						}
					}

					const lhsType = isStatic ? parameters[0].getType().getText() : classType;
					const rhsType = isStatic ? parameters[1].getType().getText() : parameters[0].getType().getText();

					if (isStatic && lhsType !== classType && rhsType !== classType)
					{
						throw new Error(
							`Function ${element.getText()} must have either LHS or RHS matching the class type '${classType}'`
						);
					}

					const operatorOverloads = this.get(syntaxKind) ?? new Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>();
					const lhsMap = operatorOverloads.get(lhsType) ?? new Map<RhsTypeName, OverloadDescription>();

					if (lhsMap.has(rhsType))
					{
						throw new Error(
							`Duplicate overload for operator ${SyntaxKind[syntaxKind]} with LHS type ${lhsType} and RHS type ${rhsType}`
						);
					}

					lhsMap.set(rhsType, {
						isStatic,
						className: classType,
						propName: property.getName(),
						index,
					});
					operatorOverloads.set(lhsType, lhsMap);
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
					str += `\n          Overload: ${JSON.stringify(overload)}`;
				}
			}
		}
		return str;
	}
}
