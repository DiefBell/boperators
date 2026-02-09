import {
	Node,
	SourceFile,
	SyntaxKind,
	type Project as TsMorphProject,
} from "ts-morph";
import { operatorSymbols } from "../lib/operatorSymbols";
import { ErrorDescription, type ErrorManager } from "./ErrorManager";
import { getOperatorStringFromProperty } from "./helpers/getOperatorStringFromProperty";
import { unwrapInitializer } from "./helpers/unwrapInitializer";
import {
	comparisonOperators,
	instanceOperators,
	type OperatorString,
	type OperatorSyntaxKind,
	operatorMap,
} from "./operatorMap";

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
export type OverloadDescription = {
	isStatic: boolean;
	className: string;
	classFilePath: string;
	operatorString: string;
	index: number;
};

export class OverloadStore extends Map<
	OperatorSyntaxKind,
	Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>
> {
	private readonly _project: TsMorphProject;
	private readonly _errorManager: ErrorManager;
	private readonly _parsedFiles: Set<string> = new Set();

	/** Tracks which map entries came from which file, for targeted invalidation. */
	private readonly _fileEntries = new Map<
		string,
		Array<{ syntaxKind: OperatorSyntaxKind; lhsType: string; rhsType: string }>
	>();

	/** Cache for type hierarchy chains: type name → [self, parent, grandparent, ...] */
	private readonly _typeChainCache = new Map<string, string[]>();

	constructor(project: TsMorphProject, errorManager: ErrorManager) {
		super();

		this._project = project;
		this._errorManager = errorManager;
	}

	/**
	 * Looks up an overload description for the given operator kind and
	 * LHS/RHS type pair. Walks up the class hierarchy for both sides
	 * when an exact match isn't found.
	 */
	public findOverload(
		operatorKind: OperatorSyntaxKind,
		lhsType: string,
		rhsType: string,
	): OverloadDescription | undefined {
		const operatorOverloads = this.get(operatorKind);
		if (!operatorOverloads) return undefined;

		const lhsChain = this._getTypeChain(lhsType);
		const rhsChain = this._getTypeChain(rhsType);

		// Try each combination, most specific types first
		for (const lhs of lhsChain) {
			const lhsMap = operatorOverloads.get(lhs);
			if (!lhsMap) continue;
			for (const rhs of rhsChain) {
				const match = lhsMap.get(rhs);
				if (match) return match;
			}
		}

		return undefined;
	}

	/**
	 * Removes all overload entries that originated from the given file
	 * and marks it as unparsed so it will be re-scanned on the next call
	 * to `addOverloadsFromFile`.
	 *
	 * @returns `true` if the file had any overload entries (meaning files
	 * that were transformed using those overloads may now be stale).
	 */
	public invalidateFile(filePath: string): boolean {
		this._parsedFiles.delete(filePath);
		this._typeChainCache.clear();

		const entries = this._fileEntries.get(filePath);
		if (!entries) return false;

		for (const { syntaxKind, lhsType, rhsType } of entries) {
			this.get(syntaxKind)?.get(lhsType)?.delete(rhsType);
		}

		this._fileEntries.delete(filePath);
		return true;
	}

	public addOverloadsFromFile(file: string | SourceFile) {
		const sourceFile =
			file instanceof SourceFile
				? file
				: this._project.getSourceFileOrThrow(file);
		const filePath = sourceFile.getFilePath();
		if (this._parsedFiles.has(filePath)) return;
		this._parsedFiles.add(filePath);

		const classes = sourceFile.getClasses();

		classes.forEach((classDecl) => {
			const classType = classDecl.getType().getText();

			// Iterate through static properties
			classDecl.getProperties().forEach((property) => {
				if (!Node.isPropertyDeclaration(property)) return; // Only process property declarations

				const isStatic = property.isStatic();

				const operatorString = getOperatorStringFromProperty(property);
				if (!operatorString || !operatorSymbols.includes(operatorString))
					return;

				const syntaxKind = operatorMap[operatorString as OperatorString];
				if (!syntaxKind) return;

				if (
					(isStatic && instanceOperators.has(syntaxKind)) ||
					(!isStatic && !instanceOperators.has(syntaxKind))
				) {
					this._errorManager.addWarning(
						new ErrorDescription(
							`Expected overload for operator ${operatorString} ` +
								`to be ${isStatic ? "a static" : "an instance"} field.`,
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							property.getText().split("\n")[0],
						),
					);
					return;
				}

				const rawInitializer = property.getInitializer();
				const hasAsConst =
					rawInitializer &&
					Node.isAsExpression(rawInitializer) &&
					rawInitializer.getTypeNode()?.getText() === "const";

				const initializer = unwrapInitializer(rawInitializer);

				if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
					this._errorManager.addWarning(
						new ErrorDescription(
							`Overload field for operator ${operatorString} ` +
								"must be an array of overload functions.",
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(property.getName()),
						),
					);
					return;
				}

				if (!hasAsConst) {
					this._errorManager.addError(
						new ErrorDescription(
							`Overload array for operator ${operatorString} must use "as const". ` +
								"Without it, TypeScript widens the array type and loses individual " +
								"function signatures, causing type errors in generated code.",
							property.getSourceFile().getFilePath(),
							property.getStartLineNumber(),
							this._minifyString(property.getText().split("\n")[0] ?? ""),
						),
					);
					return;
				}

				initializer.getElements().forEach((element, index) => {
					let hasWarning = false;

					if (element.isKind(SyntaxKind.ArrowFunction) && !isStatic) {
						this._errorManager.addError(
							new ErrorDescription(
								`Overload ${index} for operator ${operatorString} must not be an arrow function. ` +
									"Use a function expression instead, as arrow functions cannot bind `this` correctly for instance operators.",
								element.getSourceFile().getFilePath(),
								element.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						return;
					}

					if (
						!element.isKind(SyntaxKind.FunctionExpression) &&
						!element.isKind(SyntaxKind.FunctionDeclaration) &&
						!element.isKind(SyntaxKind.ArrowFunction)
					) {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Expected overload ${index} for operator ${operatorString} to be a function.`,
								element.getSourceFile().getFilePath(),
								element.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						return;
					}

					// Exclude `this` pseudo-parameter from count
					const parameters = element
						.getParameters()
						.filter((p) => p.getName() !== "this");
					if (isStatic) {
						if (parameters.length !== 2) {
							this._errorManager.addWarning(
								new ErrorDescription(
									`Overload function ${index} for operator ${operatorString} ` +
										"must have two parameters for LHS and RHS.",
									property.getSourceFile().getFilePath(),
									property.getStartLineNumber(),
									this._minifyString(element.getText()),
								),
							);
							hasWarning = true;
						}
					} else {
						if (parameters.length !== 1) {
							this._errorManager.addWarning(
								new ErrorDescription(
									`Overload function ${element.getText()} for operator ${operatorString} ` +
										"must have exactly one parameter for the RHS.",
									property.getSourceFile().getFilePath(),
									property.getStartLineNumber(),
									this._minifyString(element.getText()),
								),
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

					if (isStatic && lhsType !== classType && rhsType !== classType) {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload for operator ${operatorString} ` +
									"must have either LHS or RHS parameter matching its class type.",
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						hasWarning = true;
					}

					const returnType = element.getReturnType().getText();

					if (comparisonOperators.has(syntaxKind) && returnType !== "boolean") {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload function ${index} for comparison operator ${operatorString} ` +
									`must have a return type of 'boolean', got '${returnType}'.`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						hasWarning = true;
					}

					if (!isStatic && returnType !== "void") {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload function ${index} for instance operator ${operatorString} ` +
									`must have a return type of 'void', got '${returnType}'.`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						hasWarning = true;
					}

					const operatorOverloads =
						this.get(syntaxKind) ??
						new Map<LhsTypeName, Map<RhsTypeName, OverloadDescription>>();
					const lhsMap =
						operatorOverloads.get(lhsType) ??
						new Map<RhsTypeName, OverloadDescription>();

					if (lhsMap.has(rhsType)) {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Duplicate overload for operator ${operatorString} with LHS type ${lhsType} and RHS type ${rhsType}`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(element.getText()),
							),
						);
						hasWarning = true;
					}

					if (hasWarning) return;

					lhsMap.set(rhsType, {
						isStatic,
						className: classDecl.getName()!,
						classFilePath: filePath,
						operatorString,
						index,
					});
					operatorOverloads.set(lhsType, lhsMap);
					this.set(syntaxKind, operatorOverloads);

					// Track this entry for file-level invalidation
					let fileEntries = this._fileEntries.get(filePath);
					if (!fileEntries) {
						fileEntries = [];
						this._fileEntries.set(filePath, fileEntries);
					}
					fileEntries.push({ syntaxKind, lhsType, rhsType });
				});
			});
		});
	}

	/**
	 * Returns the type hierarchy chain for a given type name:
	 * [self, parent, grandparent, ...]. Primitives like "number"
	 * return a single-element array.
	 */
	private _getTypeChain(typeName: string): string[] {
		const cached = this._typeChainCache.get(typeName);
		if (cached) return cached;

		const chain = [typeName];

		// Extract simple class name from fully-qualified type strings
		// e.g. 'import("C:/path/to/Foo").Foo' → 'Foo'
		const simpleName = typeName.match(/\.(\w+)$/)?.[1] ?? typeName;

		for (const sourceFile of this._project.getSourceFiles()) {
			const classDecl = sourceFile.getClass(simpleName);
			if (classDecl) {
				let current = classDecl.getBaseClass();
				while (current) {
					chain.push(current.getType().getText());
					current = current.getBaseClass();
				}
				break;
			}
		}

		this._typeChainCache.set(typeName, chain);
		return chain;
	}

	private _minifyString(str: string): string {
		return str.replace(/\s+/g, " ").replace("\n", "").trim();
	}

	public override toString() {
		let str = "";
		for (const [operatorSyntaxKind, lhsMap] of this) {
			str += `\n\nOperator: ${SyntaxKind[operatorSyntaxKind]}`;
			for (const [lhsType, rhsMap] of lhsMap) {
				str += `\n  - LHS Type: ${lhsType}`;
				for (const [rhsType, overload] of rhsMap) {
					str += `\n      - RHS Type: ${rhsType}`;
					str += `\n          Overload: ${JSON.stringify(overload)}`;
				}
			}
		}
		return str;
	}
}
