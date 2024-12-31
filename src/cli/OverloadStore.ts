import {
	type Project as TsMorphProject,
	type Symbol as AstSymbol,
	SyntaxKind,
	Node,
	type ClassDeclaration,
	type Identifier,
} from "ts-morph";
import { comparisonOperators, instanceOperators, operatorMap, type OperatorName, type OperatorSyntaxKind } from "./operatorMap";
import * as path from "path";
import { ErrorDescription, type ErrorManager } from "./ErrorManager";

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
	classDecl: ClassDeclaration;
	propIdentifier: Identifier;
	index: number;
};

export class OverloadStore extends Map<
	OperatorSyntaxKind,
	Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>
>
{
	private readonly _errorManager: ErrorManager;

	constructor(project: TsMorphProject, errorManager: ErrorManager)
	{
		super();

		this._errorManager = errorManager;

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

		if (operatorSymbols.size === 0)
		{
			errorManager.addError(
				"Failed to load operator symbols. "
				+ "This may indicate that boperators is not correctly installed. Exiting..."
			);
			return;
		}

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

				const propIdentifier = expression.isKind(SyntaxKind.Identifier)
					? expression
					: expression.isKind(SyntaxKind.PropertyAccessExpression)
						? expression.getNameNode()
						: null;
				if (!propIdentifier) return;

				let symbol = propIdentifier.getSymbol();
				if (!symbol) return;
				// Resolve aliased symbol if necessary
				symbol = symbol.getAliasedSymbol() ?? symbol;
				const symbolText = symbol.getEscapedName();

				const syntaxKind = operatorSymbols.get(symbol);
				if (!syntaxKind) return; // Skip if not an operator symbol

				if (
					(isStatic && instanceOperators.has(syntaxKind))
					|| (!isStatic && !instanceOperators.has(syntaxKind))
				)
				{
					errorManager.addWarning(new ErrorDescription(
						`Expected overload for operator ${symbolText} `
						+ `to be ${isStatic ? "a static" : "an instance"} field.`,
						property.getSourceFile().getFilePath(),
						property.getStartLineNumber(),
						property.getText().split("\n")[0]
					));
					return;
				}

				const initializer = property.getInitializer();
				if (!initializer || !Node.isArrayLiteralExpression(initializer))
				{
					errorManager.addWarning(new ErrorDescription(
						`Overload field for operator ${symbolText} `
						+ "must be an array of overload functions.",
						expression.getSourceFile().getFilePath(),
						expression.getStartLineNumber(),
						this._minifyString(expression.getText())
					));
					return;
				}

				initializer.getElements().forEach((element, index) =>
				{
					let hasWarning = false;
					// Explicitly check for function-like node kinds
					if (
						!element.isKind(SyntaxKind.ArrowFunction)
						&& !element.isKind(SyntaxKind.FunctionExpression)
						&& !element.isKind(SyntaxKind.FunctionDeclaration)
					)
					{
						errorManager.addWarning(new ErrorDescription(
							`Expected overload ${index} for operator ${symbolText} to be a function.`,
							element.getSourceFile().getFilePath(),
							element.getStartLineNumber(),
							this._minifyString(element.getText())
						));
						return;
					}

					const parameters = element.getParameters();
					if (isStatic)
					{
						if (parameters.length !== 2)
						{
							errorManager.addWarning(new ErrorDescription(
								`Overload function ${index} for operator ${symbolText} `
								+ "must have two parameters for LHS and RHS.",
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							));
							hasWarning = true;
						}
					}
					else
					{
						if (parameters.length !== 1)
						{
							errorManager.addWarning(new ErrorDescription(
								`Overload function ${element.getText()} for operator ${symbolText} `
								+ "must have exactly one parameter for the RHS.",
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							));
							hasWarning = true;
						}
					}

					const lhsType = isStatic ? parameters[0]?.getType().getText() : classType;
					const rhsType = isStatic ? parameters[1]?.getType().getText() : parameters[0]?.getType().getText();

					if (isStatic && lhsType !== classType && rhsType !== classType)
					{
						errorManager.addWarning(new ErrorDescription(
							`Overload for operator ${symbolText} `
							+ "must have either LHS or RHS parameter matching its class type.",
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(element.getText())
						));
						hasWarning = true;
					}

					const returnType = element.getReturnType().getText();

					if (comparisonOperators.has(syntaxKind) && returnType !== "boolean")
					{
						errorManager.addWarning(new ErrorDescription(
							`Overload function ${index} for comparison operator ${symbolText} `
							+ `must have a return type of 'boolean', got '${returnType}'.`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(element.getText())
						));
						hasWarning = true;
					}

					if (!isStatic && returnType !== "void")
					{
						errorManager.addWarning(new ErrorDescription(
							`Overload function ${index} for instance operator ${symbolText} `
							+ `must have a return type of 'void', got '${returnType}'.`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(element.getText())
						));
						hasWarning = true;
					}

					const operatorOverloads = this.get(syntaxKind) ?? new Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>();
					const lhsMap = operatorOverloads.get(lhsType) ?? new Map<RhsTypeName, OverloadDescription>();

					if (lhsMap.has(rhsType))
					{
						errorManager.addWarning(new ErrorDescription(
							`Duplicate overload for operator ${symbolText} with LHS type ${lhsType} and RHS type ${rhsType}`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(element.getText())
						));
						hasWarning = true;
					}

					if (hasWarning) return;

					lhsMap.set(rhsType, {
						isStatic,
						classDecl,
						propIdentifier,
						index,
					});
					operatorOverloads.set(lhsType, lhsMap);
					this.set(syntaxKind, operatorOverloads);
				});
			});
		});
	}

	private _minifyString(str: string): string
	{
		return str.replace(/\s+/g, " ").replace("\n", "").trim();
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
