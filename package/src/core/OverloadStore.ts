import {
	type MethodDeclaration,
	type ParameterDeclaration,
	SourceFile,
	SyntaxKind,
	type Project as TsMorphProject,
} from "ts-morph";
import { operatorSymbols } from "../lib/operatorSymbols";
import type { BopLogger } from "./BopConfig";
import { ErrorDescription, type ErrorManager } from "./ErrorManager";
import { getOperatorStringFromMethod } from "./helpers/getOperatorStringFromMethod";
import { normalizeTypeName } from "./helpers/resolveExpressionType";
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
	prefixUnaryOperatorMap,
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
	returnType: string;
};

/**
 * A flat representation of a registered overload, suitable for
 * external consumption (e.g. MCP server, tooling).
 */
export type OverloadInfo = {
	kind: "binary" | "prefixUnary" | "postfixUnary";
	className: string;
	classFilePath: string;
	operatorString: string;
	isStatic: boolean;
	/** LHS type name (binary overloads only). */
	lhsType?: string;
	/** RHS type name (binary overloads only). */
	rhsType?: string;
	/** Operand type name (unary overloads only). */
	operandType?: string;
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
	 * Returns a flat array of all registered overloads (binary, prefix unary,
	 * and postfix unary) with clean type names.
	 */
	public getAllOverloads(): OverloadInfo[] {
		const results: OverloadInfo[] = [];
		const sl = this._shortTypeName.bind(this);

		for (const [_syntaxKind, lhsMap] of this) {
			for (const [lhsType, rhsMap] of lhsMap) {
				for (const [rhsType, desc] of rhsMap) {
					results.push({
						kind: "binary",
						...desc,
						lhsType: sl(lhsType),
						rhsType: sl(rhsType),
					});
				}
			}
		}

		for (const [_syntaxKind, operandMap] of this._prefixUnaryOverloads) {
			for (const [operandType, desc] of operandMap) {
				results.push({
					kind: "prefixUnary",
					...desc,
					operandType: sl(operandType),
				});
			}
		}

		for (const [_syntaxKind, operandMap] of this._postfixUnaryOverloads) {
			for (const [operandType, desc] of operandMap) {
				results.push({
					kind: "postfixUnary",
					...desc,
					operandType: sl(operandType),
				});
			}
		}

		return results;
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
			const className = classDecl.getName();
			if (!className) return; // skip anonymous classes

			const classType = normalizeTypeName(classDecl.getType().getText());

			// Group method declarations by operator string.
			// For each implementation, we use its overload signatures for per-type discrimination.
			// If there are no overload signatures (simple one-signature methods), we use the
			// implementation itself. In .d.ts files getMethods() returns declaration-only nodes with
			// no body and no overloads, so they are naturally pushed as-is and treated as individual sigs.
			const methodGroups = new Map<string, MethodDeclaration[]>();
			for (const method of classDecl.getMethods()) {
				const operatorString = getOperatorStringFromMethod(method);
				if (!operatorString || !operatorSymbols.includes(operatorString))
					continue;
				let group = methodGroups.get(operatorString);
				if (!group) {
					group = [];
					methodGroups.set(operatorString, group);
				}
				// Use individual overload signatures for per-type discrimination.
				// Fall back to the implementation itself when there are no overloads.
				const overloadSigs = method.getOverloads();
				group.push(...(overloadSigs.length > 0 ? overloadSigs : [method]));
			}

			methodGroups.forEach((methods, operatorString) => {
				// All entries are either overload signatures (no body) or implementations
				// with no overloads. Use the no-body ones preferentially; if all have bodies
				// (implementation-only methods), use them directly.
				const overloadSigs = methods.filter((m) => !m.hasBody());
				const sigsToProcess = overloadSigs.length > 0 ? overloadSigs : methods;

				if (sigsToProcess.length === 0) return;

				const isStatic = sigsToProcess[0].isStatic();

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

				// Validate static/instance context at the method group level
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
							`Expected overload for operator "${operatorString}" ` +
								`to be ${isStatic ? "a static" : "an instance"} method.`,
							sigsToProcess[0].getSourceFile().getFilePath(),
							sigsToProcess[0].getStartLineNumber(),
							this._minifyString(sigsToProcess[0].getText().split("\n")[0]),
						),
					);
					return;
				}

				sigsToProcess.forEach((method) => {
					// Exclude the `this` pseudo-parameter if explicitly declared
					const parameters = method
						.getParameters()
						.filter((p) => p.getName() !== "this");
					const paramCount = parameters.length;

					if (
						paramCount === 2 &&
						isStatic &&
						binarySyntaxKind &&
						!instanceOperators.has(binarySyntaxKind)
					) {
						this._addBinaryOverload(
							binarySyntaxKind,
							className,
							classType,
							filePath,
							method,
							parameters,
							operatorString,
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
							className,
							classType,
							filePath,
							method,
							parameters,
							operatorString,
							false,
						);
					} else if (paramCount === 1 && isStatic && prefixUnarySyntaxKind) {
						this._addPrefixUnaryOverload(
							prefixUnarySyntaxKind,
							className,
							classType,
							filePath,
							method,
							parameters,
							operatorString,
						);
					} else if (paramCount === 0 && !isStatic && postfixUnarySyntaxKind) {
						this._addPostfixUnaryOverload(
							postfixUnarySyntaxKind,
							className,
							classType,
							filePath,
							method,
							operatorString,
						);
					} else {
						this._errorManager.addWarning(
							new ErrorDescription(
								`Overload signature for operator "${operatorString}" ` +
									`has invalid parameter count (${paramCount}) for this operator context.`,
								method.getSourceFile().getFilePath(),
								method.getStartLineNumber(),
								this._minifyString(method.getText().split("\n")[0]),
							),
						);
					}
				});
			});
		});
	}

	private _addBinaryOverload(
		syntaxKind: OperatorSyntaxKind,
		className: string,
		classType: string,
		filePath: string,
		method: MethodDeclaration,
		parameters: ParameterDeclaration[],
		operatorString: string,
		isStatic: boolean,
	): void {
		let hasWarning = false;

		// Use the declared type annotation text rather than the resolved type.
		// `parameter.getType().getText()` on an overload signature may return a union
		// of all overload signatures' types (e.g. `Vec2 | undefined`) instead of the
		// type declared in this specific signature (e.g. `Vec2`).
		const getParamTypeName = (p: ParameterDeclaration | undefined): string =>
			normalizeTypeName(
				p?.getTypeNode()?.getText() ?? p?.getType().getText() ?? "",
			);

		const lhsType = isStatic ? getParamTypeName(parameters[0]) : classType;
		const rhsType = isStatic
			? getParamTypeName(parameters[1])
			: getParamTypeName(parameters[0]);

		if (isStatic && lhsType !== classType && rhsType !== classType) {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Overload for operator "${operatorString}" ` +
						"must have either LHS or RHS parameter matching its class type.",
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
				),
			);
			hasWarning = true;
		}

		const returnType = method.getReturnType().getText();

		if (comparisonOperators.has(syntaxKind) && returnType !== "boolean") {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Overload for comparison operator "${operatorString}" ` +
						`must have a return type of 'boolean', got '${returnType}'.`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
				),
			);
			hasWarning = true;
		}

		if (!isStatic && returnType !== "void") {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Overload for instance operator "${operatorString}" ` +
						`must have a return type of 'void', got '${returnType}'.`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
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
					`Duplicate overload for operator "${operatorString}" with LHS type ${lhsType} and RHS type ${rhsType}`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
				),
			);
			hasWarning = true;
		}

		if (hasWarning) return;

		lhsMap.set(rhsType, {
			isStatic,
			className: className,
			classFilePath: filePath,
			operatorString,
			returnType,
		});
		operatorOverloads.set(lhsType, lhsMap);
		this.set(syntaxKind, operatorOverloads);

		const sl = this._shortTypeName.bind(this);
		this._logger.debug(
			`Loaded ${className}["${operatorString}"]: (${sl(lhsType)}, ${sl(rhsType)}) => ${sl(returnType)}${isStatic ? " (static)" : " (instance)"}`,
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
		className: string,
		classType: string,
		filePath: string,
		method: MethodDeclaration,
		parameters: ParameterDeclaration[],
		operatorString: string,
	): void {
		let hasWarning = false;

		// Use the declared type annotation to avoid union widening from overload groups.
		const operandType = normalizeTypeName(
			parameters[0]?.getTypeNode()?.getText() ??
				parameters[0]?.getType().getText() ??
				"",
		);

		if (operandType !== classType) {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Prefix unary overload for operator "${operatorString}" ` +
						"must have its parameter matching its class type.",
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
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
					`Duplicate prefix unary overload for operator "${operatorString}" with operand type ${operandType}`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
				),
			);
			hasWarning = true;
		}

		if (hasWarning) return;

		const returnType = method.getReturnType().getText();

		operatorOverloads.set(operandType, {
			isStatic: true,
			className: className,
			classFilePath: filePath,
			operatorString,
			returnType,
		});
		this._prefixUnaryOverloads.set(syntaxKind, operatorOverloads);

		const sl = this._shortTypeName.bind(this);
		this._logger.debug(
			`Loaded ${className}["${operatorString}"]: ${operatorString}(${sl(operandType)}) => ${sl(returnType)} (prefix unary)`,
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
		className: string,
		classType: string,
		filePath: string,
		method: MethodDeclaration,
		operatorString: string,
	): void {
		let hasWarning = false;

		const returnType = method.getReturnType().getText();

		if (returnType !== "void") {
			this._errorManager.addWarning(
				new ErrorDescription(
					`Overload for postfix operator "${operatorString}" ` +
						`must have a return type of 'void', got '${returnType}'.`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
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
					`Duplicate postfix unary overload for operator "${operatorString}" with operand type ${operandType}`,
					method.getSourceFile().getFilePath(),
					method.getStartLineNumber(),
					this._minifyString(method.getText().split("\n")[0]),
				),
			);
			hasWarning = true;
		}

		if (hasWarning) return;

		operatorOverloads.set(operandType, {
			isStatic: false,
			className: className,
			classFilePath: filePath,
			operatorString,
			returnType,
		});
		this._postfixUnaryOverloads.set(syntaxKind, operatorOverloads);

		this._logger.debug(
			`Loaded ${className}["${operatorString}"]: ${this._shortTypeName(operandType)}${operatorString} () (postfix unary)`,
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
					chain.push(normalizeTypeName(current.getType().getText()));
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
