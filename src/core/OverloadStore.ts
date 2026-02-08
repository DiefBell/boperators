import {
	type Project as TsMorphProject,
	type ClassDeclaration,
	SyntaxKind,
	Node,
	SourceFile,
} from "ts-morph";
import {
	type OperatorString,
	type OperatorSyntaxKind,
	comparisonOperators,
	instanceOperators,
	operatorMap,
} from "./operatorMap";
import { type ErrorManager, ErrorDescription } from "./ErrorManager";
import { operatorSymbols } from "../lib/operatorSymbols";

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
	operatorString: string;
	index: number;
};

export class OverloadStore extends Map<
	OperatorSyntaxKind,
	Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>
>
{
	private readonly _project: TsMorphProject;
	private readonly _errorManager: ErrorManager;
	private readonly _parsedFiles: Set<SourceFile> = new Set();

	constructor(project: TsMorphProject, errorManager: ErrorManager)
	{
		super();

		this._project = project;
		this._errorManager = errorManager;
	}

	/**
	 * Clears all stored overloads and parsed file tracking.
	 * Must be called before re-scanning files whose AST nodes may have changed
	 * (e.g. in the language server plugin where files are repeatedly rewritten).
	 */
	public reset(): void
	{
		this.clear();
		this._parsedFiles.clear();
	}

	public addOverloadsFromFile(file: string | SourceFile)
	{
		const sourceFile = file instanceof SourceFile ? file : this._project.getSourceFileOrThrow(file);
		if (this._parsedFiles.has(sourceFile)) return;
		this._parsedFiles.add(sourceFile);

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

				// Try to get the operator string value from the computed property name
				let operatorString: string | undefined;
				if (expression.isKind(SyntaxKind.StringLiteral))
				{
					operatorString = expression.getLiteralValue();
				}
				else
				{
					// Handle Operator.PLUS style (enum member access)
					const literalValue = expression.getType().getLiteralValue();
					if (typeof literalValue === "string")
					{
						operatorString = literalValue;
					}
				}

				if (!operatorString || !operatorSymbols.includes(operatorString)) return;

				const syntaxKind = operatorMap[operatorString as OperatorString];
				if (!syntaxKind) return;

				if (
					(isStatic && instanceOperators.has(syntaxKind))
					|| (!isStatic && !instanceOperators.has(syntaxKind))
				)
				{
					this._errorManager.addWarning(
						new ErrorDescription(
							`Expected overload for operator ${operatorString} `
							+ `to be ${isStatic ? "a static" : "an instance"} field.`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							property.getText().split("\n")[0]
						)
					);
					return;
				}

				// Unwrap `as const` / `satisfies` if present
				let initializer = property.getInitializer();
				if (initializer && Node.isAsExpression(initializer))
					initializer = initializer.getExpression();
				if (initializer && Node.isSatisfiesExpression(initializer))
					initializer = initializer.getExpression();

				if (!initializer || !Node.isArrayLiteralExpression(initializer))
				{
					this._errorManager.addWarning(
						new ErrorDescription(
							`Overload field for operator ${operatorString} `
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

					if (element.isKind(SyntaxKind.ArrowFunction))
					{
						this._errorManager.addError(
							new ErrorDescription(
								`Overload ${index} for operator ${operatorString} must not be an arrow function. `
								+ "Use a function expression instead, as arrow functions cannot bind `this` correctly for instance operators.",
								element.getSourceFile().getFilePath(),
								element.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						return;
					}

					if (
						!element.isKind(SyntaxKind.FunctionExpression)
						&& !element.isKind(SyntaxKind.FunctionDeclaration)
					)
					{
						this._errorManager.addWarning(
							new ErrorDescription(
								`Expected overload ${index} for operator ${operatorString} to be a function.`,
								element.getSourceFile().getFilePath(),
								element.getStartLineNumber(),
								this._minifyString(element.getText())
							)
						);
						return;
					}

					// Exclude `this` pseudo-parameter from count
					const parameters = element.getParameters()
						.filter((p) => p.getName() !== "this");
					if (isStatic)
					{
						if (parameters.length !== 2)
						{
							this._errorManager.addWarning(
								new ErrorDescription(
									`Overload function ${index} for operator ${operatorString} `
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
									`Overload function ${element.getText()} for operator ${operatorString} `
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
								`Overload for operator ${operatorString} `
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
								`Overload function ${index} for comparison operator ${operatorString} `
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
								`Overload function ${index} for instance operator ${operatorString} `
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
								`Duplicate overload for operator ${operatorString} with LHS type ${lhsType} and RHS type ${rhsType}`,
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
						operatorString,
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
