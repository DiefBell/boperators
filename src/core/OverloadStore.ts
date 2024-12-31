import {
	type Project as TsMorphProject,
	type Symbol as AstSymbol,
	type ClassDeclaration,
	type Identifier,
	SyntaxKind,
	Node,
	SourceFile,
} from "ts-morph";
import {
	type OperatorName,
	type OperatorSyntaxKind,
	comparisonOperators,
	instanceOperators,
	operatorMap,
} from "./operatorMap";
import * as path from "path";
import { type ErrorManager, ErrorDescription } from "./ErrorManager";

export const LIB_ROOT = path.join(
	import.meta.dir, // consts
	"..", // src
	"lib"
);

export const OPERATOR_SYMBOLS_FILE = path.join(LIB_ROOT, "operatorSymbols.ts");

/**
 * Name of the type of node on the left-hand side of the operator.
 * Exists purely to make it clear what's where in the map typings.
 */
type LhsTypeName = string;

/**
 * Name of the type of node on the right-hand side of the operator.
 * Exists purely to make it clear what's where in the map typings.
 */
type RhsTypeName = string;

/**
 * Information about an overload so that we can
 * substitute it over binary expressions.
 */
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
	private readonly _project: TsMorphProject;
	private readonly _errorManager: ErrorManager;
	private readonly _operatorSymbols: Map<AstSymbol, OperatorSyntaxKind>;

	constructor(project: TsMorphProject, errorManager: ErrorManager)
	{
		super();

		this._project = project;
		this._errorManager = errorManager;

		project.addSourceFileAtPath(OPERATOR_SYMBOLS_FILE);
		const operatorSymbolsFile = project.getSourceFile(OPERATOR_SYMBOLS_FILE);
		this._operatorSymbols = new Map<AstSymbol, OperatorSyntaxKind>(
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

		if (this._operatorSymbols.size === 0)
		{
			this._errorManager.addError(
				"Failed to load operator symbols. "
				+ "This may indicate that boperators is not correctly installed. Exiting..."
			);
			return;
		}
	}

	public addOverloadsFromFile(file: string | SourceFile)
	{
		const sourceFile = file instanceof SourceFile ? file : this._project.getSourceFileOrThrow(file);
		const classes = sourceFile.getClasses();

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

				const syntaxKind = this._operatorSymbols.get(symbol);
				if (!syntaxKind) return; // Skip if not an operator symbol

				if (
					(isStatic && instanceOperators.has(syntaxKind))
					|| (!isStatic && !instanceOperators.has(syntaxKind))
				)
				{
					this._errorManager.addWarning(
						new ErrorDescription(
							`Expected overload for operator ${symbolText} `
							+ `to be ${isStatic ? "a static" : "an instance"} field.`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							property.getText().split("\n")[0]
						)
					);
					return;
				}

				const initializer = property.getInitializer();
				if (!initializer || !Node.isArrayLiteralExpression(initializer))
				{
					this._errorManager.addWarning(
						new ErrorDescription(
							`Overload field for operator ${symbolText} `
							+ "must be an array of overload functions.",
							expression.getSourceFile().getFilePath(),
							expression.getStartLineNumber(),
							this._minifyString(expression.getText())
						)
					);
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
						this._errorManager.addWarning(
							new ErrorDescription(
								`Expected overload ${index} for operator ${symbolText} to be a function.`,
								element.getSourceFile().getFilePath(),
								element.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						return;
					}

					const parameters = element.getParameters();
					if (isStatic)
					{
						if (parameters.length !== 2)
						{
							this._errorManager.addWarning(
								new ErrorDescription(
									`Overload function ${index} for operator ${symbolText} `
									+ "must have two parameters for LHS and RHS.",
									property.getSourceFile().getFilePath(),
									property.getStartLineNumber(),
									this._minifyString(element.getText())
								)
							);
							hasWarning = true;
						}
					}
					else
					{
						if (parameters.length !== 1)
						{
							this._errorManager.addWarning(
								new ErrorDescription(
									`Overload function ${element.getText()} for operator ${symbolText} `
									+ "must have exactly one parameter for the RHS.",
									property.getSourceFile().getFilePath(),
									property.getStartLineNumber(),
									this._minifyString(element.getText())
								)
							);
							hasWarning = true;
						}
					}

					const lhsType = isStatic
						? parameters[0]?.getType().getText()
						: classType;
					const rhsType = isStatic
						? parameters[1]?.getType().getText()
						: parameters[0]?.getType().getText();

					if (isStatic && lhsType !== classType && rhsType !== classType)
					{
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload for operator ${symbolText} `
								+ "must have either LHS or RHS parameter matching its class type.",
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						hasWarning = true;
					}

					const returnType = element.getReturnType().getText();

					if (comparisonOperators.has(syntaxKind) && returnType !== "boolean")
					{
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload function ${index} for comparison operator ${symbolText} `
								+ `must have a return type of 'boolean', got '${returnType}'.`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						hasWarning = true;
					}

					if (!isStatic && returnType !== "void")
					{
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload function ${index} for instance operator ${symbolText} `
								+ `must have a return type of 'void', got '${returnType}'.`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						hasWarning = true;
					}

					const operatorOverloads
            = this.get(syntaxKind)
            ?? new Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>();
					const lhsMap
            = operatorOverloads.get(lhsType)
            ?? new Map<RhsTypeName, OverloadDescription>();

					if (lhsMap.has(rhsType))
					{
						this._errorManager.addWarning(
							new ErrorDescription(
								`Duplicate overload for operator ${symbolText} with LHS type ${lhsType} and RHS type ${rhsType}`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
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
