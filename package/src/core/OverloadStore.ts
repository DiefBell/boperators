import {
	type ArrowFunction,
	type ClassDeclaration,
	type FunctionDeclaration,
	type FunctionExpression,
	Node,
	type ParameterDeclaration,
	type PropertyDeclaration,
	SourceFile,
	SyntaxKind,
	type Project as TsMorphProject,
} from "ts-morph";
import { operatorSymbols } from "../lib/operatorSymbols";
import type { BopLogger } from "./BopConfig";
import { ErrorDescription, type ErrorManager } from "./ErrorManager";
import { getOperatorStringFromProperty } from "./helpers/getOperatorStringFromProperty";
import { unwrapInitializer } from "./helpers/unwrapInitializer";
import {
	comparisonOperators,
	instanceOperators,
	type OperatorString,
	type OperatorSyntaxKind,
	operatorMap,
	type PostfixUnaryOperatorString,
	type PostfixUnaryOperatorSyntaxKind,
	type PrefixUnaryOperatorString,
	type PrefixUnaryOperatorSyntaxKind,
	postfixUnaryOperatorMap,
	postfixUnaryOperatorStrings,
	prefixUnaryOperatorMap,
	prefixUnaryOperatorStrings,
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
 * Name of the type of the operand in a unary expression.
 * Exists purely to make it clear what's where in the map typings.
 */
type OperandTypeName = string;

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

	/** Storage for prefix unary overloads: operator → operandType → description */
	private readonly _prefixUnaryOverloads = new Map<
		PrefixUnaryOperatorSyntaxKind,
		Map<OperandTypeName, OverloadDescription>
	>();

	/** Storage for postfix unary overloads: operator → operandType → description */
	private readonly _postfixUnaryOverloads = new Map<
		PostfixUnaryOperatorSyntaxKind,
		Map<OperandTypeName, OverloadDescription>
	>();

	/** Tracks which prefix unary entries came from which file, for targeted invalidation. */
	private readonly _prefixUnaryFileEntries = new Map<
		string,
		Array<{
			syntaxKind: PrefixUnaryOperatorSyntaxKind;
			operandType: string;
		}>
	>();

	/** Tracks which postfix unary entries came from which file, for targeted invalidation. */
	private readonly _postfixUnaryFileEntries = new Map<
		string,
		Array<{
			syntaxKind: PostfixUnaryOperatorSyntaxKind;
			operandType: string;
		}>
	>();

	private readonly _logger: BopLogger;

	constructor(
		project: TsMorphProject,
		errorManager: ErrorManager,
		logger: BopLogger,
	) {
		super();

		this._project = project;
		this._errorManager = errorManager;
		this._logger = logger;
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
	 * Looks up a prefix unary overload description for the given operator kind
	 * and operand type. Walks up the class hierarchy when an exact match isn't found.
	 */
	public findPrefixUnaryOverload(
		operatorKind: PrefixUnaryOperatorSyntaxKind,
		operandType: string,
	): OverloadDescription | undefined {
		const operatorOverloads = this._prefixUnaryOverloads.get(operatorKind);
		if (!operatorOverloads) return undefined;

		const typeChain = this._getTypeChain(operandType);
		for (const t of typeChain) {
			const match = operatorOverloads.get(t);
			if (match) return match;
		}
		return undefined;
	}

	/**
	 * Looks up a postfix unary overload description for the given operator kind
	 * and operand type. Walks up the class hierarchy when an exact match isn't found.
	 */
	public findPostfixUnaryOverload(
		operatorKind: PostfixUnaryOperatorSyntaxKind,
		operandType: string,
	): OverloadDescription | undefined {
		const operatorOverloads = this._postfixUnaryOverloads.get(operatorKind);
		if (!operatorOverloads) return undefined;

		const typeChain = this._getTypeChain(operandType);
		for (const t of typeChain) {
			const match = operatorOverloads.get(t);
			if (match) return match;
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

		let hadEntries = false;

		const entries = this._fileEntries.get(filePath);
		if (entries) {
			for (const { syntaxKind, lhsType, rhsType } of entries) {
				this.get(syntaxKind)?.get(lhsType)?.delete(rhsType);
			}
			this._fileEntries.delete(filePath);
			hadEntries = true;
		}

		const prefixEntries = this._prefixUnaryFileEntries.get(filePath);
		if (prefixEntries) {
			for (const { syntaxKind, operandType } of prefixEntries) {
				this._prefixUnaryOverloads.get(syntaxKind)?.delete(operandType);
			}
			this._prefixUnaryFileEntries.delete(filePath);
			hadEntries = true;
		}

		const postfixEntries = this._postfixUnaryFileEntries.get(filePath);
		if (postfixEntries) {
			for (const { syntaxKind, operandType } of postfixEntries) {
				this._postfixUnaryOverloads.get(syntaxKind)?.delete(operandType);
			}
			this._postfixUnaryFileEntries.delete(filePath);
			hadEntries = true;
		}

		return hadEntries;
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

			classDecl.getProperties().forEach((property) => {
				if (!Node.isPropertyDeclaration(property)) return;

				const isStatic = property.isStatic();

				const operatorString = getOperatorStringFromProperty(property);
				if (!operatorString || !operatorSymbols.includes(operatorString))
					return;

				// Look up the operator in all three maps
				const binarySyntaxKind = operatorMap[operatorString as OperatorString];
				const prefixUnarySyntaxKind =
					prefixUnaryOperatorMap[operatorString as PrefixUnaryOperatorString];
				const postfixUnarySyntaxKind =
					postfixUnaryOperatorMap[operatorString as PostfixUnaryOperatorString];

				if (
					!binarySyntaxKind &&
					!prefixUnarySyntaxKind &&
					!postfixUnarySyntaxKind
				)
					return;

				// Property-level static/instance validation.
				// Determine what this property should be based on the operator kinds it supports.
				const shouldBeStatic =
					(binarySyntaxKind != null &&
						!instanceOperators.has(binarySyntaxKind)) ||
					prefixUnarySyntaxKind != null;
				const shouldBeInstance =
					(binarySyntaxKind != null &&
						instanceOperators.has(binarySyntaxKind)) ||
					postfixUnarySyntaxKind != null;

				if ((isStatic && !shouldBeStatic) || (!isStatic && !shouldBeInstance)) {
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

					// At this point element is guaranteed to be a function-like node
					const funcElement = element as
						| FunctionExpression
						| ArrowFunction
						| FunctionDeclaration;

					// Exclude `this` pseudo-parameter from count
					const parameters = funcElement
						.getParameters()
						.filter((p) => p.getName() !== "this");
					const paramCount = parameters.length;

					// Dispatch by parameter count to determine overload kind
					if (
						paramCount === 2 &&
						isStatic &&
						binarySyntaxKind &&
						!instanceOperators.has(binarySyntaxKind)
					) {
						this._addBinaryOverload(
							binarySyntaxKind,
							classDecl,
							classType,
							filePath,
							property,
							funcElement,
							parameters,
							operatorString,
							index,
							true,
						);
					} else if (
						paramCount === 1 &&
						!isStatic &&
						binarySyntaxKind &&
						instanceOperators.has(binarySyntaxKind)
					) {
						this._addBinaryOverload(
							binarySyntaxKind,
							classDecl,
							classType,
							filePath,
							property,
							funcElement,
							parameters,
							operatorString,
							index,
							false,
						);
					} else if (paramCount === 1 && isStatic && prefixUnarySyntaxKind) {
						this._addPrefixUnaryOverload(
							prefixUnarySyntaxKind,
							classDecl,
							classType,
							filePath,
							property,
							funcElement,
							parameters,
							operatorString,
							index,
						);
					} else if (paramCount === 0 && !isStatic && postfixUnarySyntaxKind) {
						this._addPostfixUnaryOverload(
							postfixUnarySyntaxKind,
							classDecl,
							classType,
							filePath,
							property,
							funcElement as FunctionExpression | FunctionDeclaration,
							operatorString,
							index,
						);
					} else {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload function ${index} for operator ${operatorString} ` +
									`has invalid parameter count (${paramCount}) for this operator context.`,
								property.getSourceFile().getFilePath(),
								property.getStartLineNumber(),
								this._minifyString(funcElement.getText()),
							),
						);
					}
				});
			});
		});
	}

	private _addBinaryOverload(
		syntaxKind: OperatorSyntaxKind,
		classDecl: ClassDeclaration,
		classType: string,
		filePath: string,
		property: PropertyDeclaration,
		element: FunctionExpression | ArrowFunction | FunctionDeclaration,
		parameters: ParameterDeclaration[],
		operatorString: string,
		index: number,
		isStatic: boolean,
	): void {
		let hasWarning = false;

		const lhsType = isStatic ? parameters[0]?.getType().getText() : classType;
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

		const funcName = Node.isFunctionExpression(element)
			? element.getName()
			: undefined;
		const sl = this._shortTypeName.bind(this);
		const label = funcName
			? `${funcName}(${sl(lhsType)}, ${sl(rhsType)})`
			: `(${sl(lhsType)}, ${sl(rhsType)})`;
		this._logger.debug(
			`Loaded ${classDecl.getName()}["${operatorString}"][${index}]: ${label} => ${sl(element.getReturnType().getText())}${isStatic ? " (static)" : " (instance)"}`,
		);

		let fileEntries = this._fileEntries.get(filePath);
		if (!fileEntries) {
			fileEntries = [];
			this._fileEntries.set(filePath, fileEntries);
		}
		fileEntries.push({ syntaxKind, lhsType, rhsType });
	}

	private _addPrefixUnaryOverload(
		syntaxKind: PrefixUnaryOperatorSyntaxKind,
		classDecl: ClassDeclaration,
		classType: string,
		filePath: string,
		property: PropertyDeclaration,
		element: FunctionExpression | ArrowFunction | FunctionDeclaration,
		parameters: ParameterDeclaration[],
		operatorString: string,
		index: number,
	): void {
		let hasWarning = false;

		const operandType = parameters[0]?.getType().getText();

		if (operandType !== classType) {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Prefix unary overload for operator ${operatorString} ` +
						"must have its parameter matching its class type.",
					property.getSourceFile().getFilePath(),
					property.getStartLineNumber(),
					this._minifyString(element.getText()),
				),
			);
			hasWarning = true;
		}

		const operatorOverloads =
			this._prefixUnaryOverloads.get(syntaxKind) ??
			new Map<OperandTypeName, OverloadDescription>();

		if (operatorOverloads.has(operandType)) {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Duplicate prefix unary overload for operator ${operatorString} with operand type ${operandType}`,
					property.getSourceFile().getFilePath(),
					property.getStartLineNumber(),
					this._minifyString(element.getText()),
				),
			);
			hasWarning = true;
		}

		if (hasWarning) return;

		operatorOverloads.set(operandType, {
			isStatic: true,
			className: classDecl.getName()!,
			classFilePath: filePath,
			operatorString,
			index,
		});
		this._prefixUnaryOverloads.set(syntaxKind, operatorOverloads);

		const funcName = Node.isFunctionExpression(element)
			? element.getName()
			: undefined;
		const sl = this._shortTypeName.bind(this);
		const returnType = sl(element.getReturnType().getText());
		const label = funcName
			? `${funcName}(${sl(operandType)})`
			: `(${sl(operandType)})`;
		this._logger.debug(
			`Loaded ${classDecl.getName()}["${operatorString}"][${index}]: ${operatorString}${label} => ${returnType} (prefix unary)`,
		);

		let fileEntries = this._prefixUnaryFileEntries.get(filePath);
		if (!fileEntries) {
			fileEntries = [];
			this._prefixUnaryFileEntries.set(filePath, fileEntries);
		}
		fileEntries.push({ syntaxKind, operandType });
	}

	private _addPostfixUnaryOverload(
		syntaxKind: PostfixUnaryOperatorSyntaxKind,
		classDecl: ClassDeclaration,
		classType: string,
		filePath: string,
		property: PropertyDeclaration,
		element: FunctionExpression | FunctionDeclaration,
		operatorString: string,
		index: number,
	): void {
		let hasWarning = false;

		const returnType = element.getReturnType().getText();

		if (returnType !== "void") {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Overload function ${index} for postfix operator ${operatorString} ` +
						`must have a return type of 'void', got '${returnType}'.`,
					property.getSourceFile().getFilePath(),
					property.getStartLineNumber(),
					this._minifyString(element.getText()),
				),
			);
			hasWarning = true;
		}

		const operandType = classType;
		const operatorOverloads =
			this._postfixUnaryOverloads.get(syntaxKind) ??
			new Map<OperandTypeName, OverloadDescription>();

		if (operatorOverloads.has(operandType)) {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Duplicate postfix unary overload for operator ${operatorString} with operand type ${operandType}`,
					property.getSourceFile().getFilePath(),
					property.getStartLineNumber(),
					this._minifyString(element.getText()),
				),
			);
			hasWarning = true;
		}

		if (hasWarning) return;

		operatorOverloads.set(operandType, {
			isStatic: false,
			className: classDecl.getName()!,
			classFilePath: filePath,
			operatorString,
			index,
		});
		this._postfixUnaryOverloads.set(syntaxKind, operatorOverloads);

		const funcName = Node.isFunctionExpression(element)
			? element.getName()
			: undefined;
		const label = funcName ? `${funcName}()` : "()";
		this._logger.debug(
			`Loaded ${classDecl.getName()}["${operatorString}"][${index}]: ${this._shortTypeName(operandType)}${operatorString} ${label} (postfix unary)`,
		);

		let fileEntries = this._postfixUnaryFileEntries.get(filePath);
		if (!fileEntries) {
			fileEntries = [];
			this._postfixUnaryFileEntries.set(filePath, fileEntries);
		}
		fileEntries.push({ syntaxKind, operandType });
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

	/** Strips `import("...").` prefixes from fully-qualified type names for readable logs. */
	private _shortTypeName(typeName: string): string {
		return typeName.replace(/import\("[^"]*"\)\./g, "");
	}

	public override toString() {
		let str = "";
		for (const [operatorSyntaxKind, lhsMap] of this) {
			str += `\n\nBinary Operator: ${SyntaxKind[operatorSyntaxKind]}`;
			for (const [lhsType, rhsMap] of lhsMap) {
				str += `\n  - LHS Type: ${lhsType}`;
				for (const [rhsType, overload] of rhsMap) {
					str += `\n      - RHS Type: ${rhsType}`;
					str += `\n          Overload: ${JSON.stringify(overload)}`;
				}
			}
		}
		for (const [syntaxKind, operandMap] of this._prefixUnaryOverloads) {
			str += `\n\nPrefix Unary Operator: ${SyntaxKind[syntaxKind]}`;
			for (const [operandType, overload] of operandMap) {
				str += `\n  - Operand Type: ${operandType}`;
				str += `\n      Overload: ${JSON.stringify(overload)}`;
			}
		}
		for (const [syntaxKind, operandMap] of this._postfixUnaryOverloads) {
			str += `\n\nPostfix Unary Operator: ${SyntaxKind[syntaxKind]}`;
			for (const [operandType, overload] of operandMap) {
				str += `\n  - Operand Type: ${operandType}`;
				str += `\n      Overload: ${JSON.stringify(overload)}`;
			}
		}
		return str;
	}
}
