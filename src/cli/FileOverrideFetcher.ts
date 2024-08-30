import ts from "typescript";
import { ADD, DIVIDE, MULTIPLY, SUBTRACT } from "../lib";
import type { OperatorOverride } from "./types/OperatorOverride";
import type { OperatorName } from "./types/Operators";

const primitiveTypes = ["number", "string", "boolean"] as const;
type PrimitiveType = typeof primitiveTypes[number];
const isPrimitive = (typeName: string): typeName is PrimitiveType =>
	primitiveTypes.includes(typeName as PrimitiveType);

class OperatorOverrideMetadata
{
	constructor(
		private _name: string,
		private _left: ts.Type | PrimitiveType,
		private _right: ts.Type | PrimitiveType,
		private _func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
	)
	{ }

	toString(): string
	{
		return `Name: ${this._name}\n`
			// Fix in prefs! https://eslint.style/rules/plus/indent-binary-ops
			// eslint-disable-next-line @stylistic/indent-binary-ops
			+ `Right: ${typeof this._right === "string" ? `${this._right} (primitive)` : `${this._right.getSymbol()?.getName()} (complex type)`}\n`
			+ `Func: ${this._func.getText()}\n`;
	}
}

export class FileOverrideFetcher
{
	[ADD]: OperatorOverride[] = [];
	[SUBTRACT]: OperatorOverride[] = [];
	[MULTIPLY]: OperatorOverride[] = [];
	[DIVIDE]: OperatorOverride[] = [];

	private readonly _checker: ts.TypeChecker;

	constructor(
		program: ts.Program,
		sourceFile: ts.SourceFile,
		operatorSymbols: Map<OperatorName, ts.Symbol>
	)
	{
		// 1
		console.log("\nSTEP ONE: GET TYPE CHECKER");
		this._checker = program.getTypeChecker();

		// 2
		console.log("\nSTEP TWO: FIND IMPORT SYMBOLS FROM OPERATORS FILE");
		const importSymbols = this._getImportsFromOperatorFile(sourceFile);
		console.log("\tNum imports", importSymbols.length);

		// 3
		console.log("\nSTEP THREE: GET COMPUTED PROPERTY DECLARATION SYMBOLS IN FILE");
		const propDeclarationSymbols = this._getComputedPropertyDeclarations(sourceFile);
		console.log("\tNum property decs", propDeclarationSymbols.length);

		// 4. Trace prop dec symbols back to original file
		// to check they match something in `operatorSymbols`.
		// Filter out those that don't.
		console.log("\nSTEP FOUR: CHECK IF COMPUTED DECLARATION SYMBOLS EQUAL OPERATOR SYMBOLS");
		const operatorOverloadDeclarations = this._filterOperatorOverloadDeclarations(
			propDeclarationSymbols,
			importSymbols,
			Array.from(operatorSymbols.values())
		);
		console.log("\tNum valid symbols", operatorOverloadDeclarations.length);

		// 5. get overload metadata
		console.log("\nSTEP FIVE: BUILD OPERATOR OVERLOAD METADATA");
		const metadatas = this._buildOverloadMetadata(operatorOverloadDeclarations);
		metadatas.forEach((metadata) =>
		{
			console.log(metadata.toString());
		});

		// 6. double check for clashes
	}

	/**
	 * Gets all of the symbols that are imports from the operators file.
	 * @param sourceFile
	 * @returns
	 */
	private _getImportsFromOperatorFile(sourceFile: ts.SourceFile): ts.Symbol[]
	{
		const importSymbols: ts.Symbol[] = [];
		const importDeclarations = sourceFile.statements.filter(ts.isImportDeclaration);

		importDeclarations.forEach((importDeclaration) =>
		{
			const importClause = importDeclaration.importClause;
			if (!importClause)
			{
				return;
			}

			// Named imports (import { ADD } from './module';)
			if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings))
			{
				importClause.namedBindings.elements.forEach((importSpecifier) =>
				{
					const symbol = this._checker.getSymbolAtLocation(importSpecifier.name);
					if (symbol)
					{
						importSymbols.push(symbol);
					}
				});
			}

			// Namespace imports (import * as ModuleName from './module';)
			else if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings))
			{
				const symbol = this._checker.getSymbolAtLocation(importClause.namedBindings.name);
				if (symbol)
				{
					importSymbols.push(symbol);
				}
			}

			// Default imports (import DefaultName from './module';)
			if (importClause.name)
			{
				const symbol = this._checker.getSymbolAtLocation(importClause.name);
				if (symbol)
				{
					importSymbols.push(symbol);
				}
			}
		});

		return importSymbols;
	}

	/**
	 * Returns the symbols for each of the property declarations
	 * that have a computed property name.
	 * @param sourceFile
	 * @returns
	 */
	private _getComputedPropertyDeclarations(sourceFile: ts.SourceFile): ts.PropertyDeclaration[]
	{
		const declarations: ts.PropertyDeclaration[] = [];

		const getPropertyDeclarationsFromNode = (node: ts.Node): void =>
		{
			if (ts.isPropertyDeclaration(node) && ts.isComputedPropertyName(node.name))
			{
				declarations.push(node);
				return;
			}

			node.forEachChild(getPropertyDeclarationsFromNode);
		};

		getPropertyDeclarationsFromNode(sourceFile);
		return declarations;
	}

	/**
	 * Filters out any propDeclarationSymbols that aren't in importSymbols.
	 * Then filters out again if those import symbols don't alias to something in operatorSymbols.
	 * Must work with both NamedImports and NamespaceImports.
	 *
	 * @param propDeclarations - Symbols for property declarations with computed names.
	 * @param importSymbols - Symbols imported into the current file, both named and namespace imports.
	 * @param operatorSymbols - Symbols from the original operator file to validate against.
	 * @returns An array of symbols that are valid operator symbols.
	 */
	private _filterOperatorOverloadDeclarations(
		propDeclarations: ts.PropertyDeclaration[],
		importSymbols: ts.Symbol[],
		operatorSymbols: ts.Symbol[]
	): ts.PropertyDeclaration[]
	{
		const validDeclarations: ts.PropertyDeclaration[] = [];

		propDeclarations.forEach((declaration) =>
		{
			// Get the computed property name expression (e.g., `ops.MULTIPLY`)
			const name = declaration.name;
			if (!ts.isComputedPropertyName(name))
			{
				return; // Ensure it is actually a computed property name
			}

			const expression = name.expression;

			if (ts.isPropertyAccessExpression(expression))
			{
				if (this._isPropertyAccessExpressionOperatorSymbol(
					expression, importSymbols, operatorSymbols
				))
				{
					validDeclarations.push(declaration);
					return;
				}
			}

			if (this._isPropertyNameOperatorSymbol(expression, importSymbols, operatorSymbols))
			{
				validDeclarations.push(declaration);
			}

			// if (
			// 	(ts.isPropertyAccessExpression(expression) && this._isPropertyAccessExpressionOperatorSymbol(
			// 		expression,
			// 		importSymbols,
			// 		operatorSymbols
			// 	))
			// 	// || (this._isPropertyNameOperatorSymbol(expression, importSymbols, operatorSymbols))
			// )
			// {
			// 	validDeclarations.push(declaration);
			// }
		});

		return validDeclarations;
	}

	/**
	 * If the computed property name is a PropertyAccessExpression
	 * i.e., `ops.MULTIPLY`, we check whether it is for one of our operatorSymbols.
	 * This is done via our importSymbols.
	 * @param expression The property access expression, e.g., `ops.DIVIDE`.
	 * @param importSymbols The symbols imported into the current file.
	 * @param operatorSymbols The symbols representing the valid operator symbols.
	 * @returns Whether the given expression corresponds to a valid operator symbol.
	 */
	private _isPropertyAccessExpressionOperatorSymbol(
		expression: ts.PropertyAccessExpression,
		importSymbols: ts.Symbol[],
		operatorSymbols: ts.Symbol[]
	): boolean
	{
		// Get the symbol for the left-hand side (namespace or module)
		let leftSymbol = this._checker.getSymbolAtLocation(expression.expression);
		if (!leftSymbol)
		{
			console.error("Could not resolve symbol for left side of property access");
			return false;
		}

		// Check if the left symbol is in the import symbols (i.e., it should be an imported namespace/module)
		if (!importSymbols.includes(leftSymbol))
		{
			console.error(`Symbol "${leftSymbol.getName()}" is not an import in its file`);
			return false;
		}

		const leftSymbolAlias = !!(leftSymbol.flags & ts.SymbolFlags.Alias)
			? this._checker.getAliasedSymbol(leftSymbol)
			: undefined;

		if (
			!leftSymbolAlias
			|| (leftSymbolAlias.flags & ts.SymbolFlags.Namespace) === 0
			|| (leftSymbolAlias.flags & ts.SymbolFlags.Module) === 0
		)
		{
			console.error(
				`Symbol "${leftSymbol.getName()}" doesn't alias anything. Are you sure it's an import?`
			);
			return false;
		}

		// At this point, `leftSymbol` is expected to be the namespace/module symbol itself.
		// Fetch the symbol that represents the module or namespace exports.
		const exportedSymbols = this._checker.getExportsOfModule(leftSymbolAlias);

		// If the exported symbols cannot be resolved, return false
		if (!exportedSymbols)
		{
			console.error(`Could not retrieve exports from module "${leftSymbol.getName()}"`);
			return false;
		}

		// Get the right-hand side name of the property access (e.g., `MULTIPLY`)
		const rightName = expression.name.text;

		// Find the right-hand symbol in the module's exports
		const rightSymbol = exportedSymbols.find(sym => sym.name === rightName);
		if (!rightSymbol)
		{
			console.error(`Symbol "${rightName}" is not an exported member of "${leftSymbol.getName()}"`);
			return false;
		}

		return operatorSymbols.includes(rightSymbol);
	}

	/**
	 * Is a computed property name is not a PropertyAccessExpression
	 * i.e. it's just `SUBTRACT`, we check whether it is one of our operatorSymbols.
	 * This is done via our importSymbols
	 * @param expression The property symbol e.g. "ADD"
	 * @param importSymbols The symbols imported into the current file.
	 * @param operatorSymbols The symbols representing the valid operator symbols.
	 * @returnsWhether the given expression corresponds to a valid operator symbol.
	 */
	private _isPropertyNameOperatorSymbol(
		expression: ts.Expression,
		importSymbols: ts.Symbol[],
		operatorSymbols: ts.Symbol[]
	): boolean
	{
		// Handle other types of expressions (direct computed names) if needed
		const symbol = this._checker.getSymbolAtLocation(expression);

		if (!symbol || !(symbol.flags & ts.SymbolFlags.Alias))
		{
			return false;
		}

		return !!symbol && operatorSymbols.includes(
			this._checker.getAliasedSymbol(symbol)
		);
	}

	/**
	 * Builds metadata for operator overloads from given property declarations.
	 * This method processes each property declaration to extract operator overload functions
	 * and their associated metadata based on the following rules:
	 *
	 * - **Valid Declarations**: Only considers declarations that are object literal expressions.
	 * - **Initializer Check**: Skips declarations that do not have an initializer.
	 * - **Class Type Extraction**: Extracts the class type from the declaration, if available.
	 * - **Function Validity**: Processes functions that are either `FunctionDeclaration`, `ArrowFunction`,
	 *   or `FunctionExpression` and verifies that they have 1 or 2 parameters.
	 * - **Return Type Check**: Skips functions that do not have a return type.
	 * - **Parameter Type Handling**:
	 *   - For 1-parameter functions:
	 *     - Sets the `left` type as the class type and the `right` type as the type of the function parameter.
	 *   - For 2-parameter functions:
	 *     - Sets `left` and `right` types based on the function parameters.
	 *     - Ensures that one of the parameters matches the class type (when applicable).
	 * - **Primitive Types Handling**: Primitive types (`number`, `string`, `boolean`) are converted to their string representation.
	 *
	 * Logs warnings for any issues encountered during processing, such as invalid initializers,
	 * unresolved parameter types, or functions that do not meet the required criteria.
	 *
	 * @param declarations An array of `ts.PropertyDeclaration` objects representing operator overload declarations.
	 * @returns An array of `OperatorOverrideMetadata` instances, each representing valid operator overload metadata.
	 */
	private _buildOverloadMetadata(declarations: ts.PropertyDeclaration[]): OperatorOverrideMetadata[]
	{
		const metadata: OperatorOverrideMetadata[] = [];

		// Helper function to check if a type is primitive and return its string representation
		const getPrimitiveTypeString = (type: ts.Type): PrimitiveType | undefined =>
		{
			const typeName = this._checker.typeToString(type);
			return isPrimitive(typeName) ? typeName : undefined;
		};

		declarations.forEach((declaration) =>
		{
			if (!declaration.initializer)
			{
				console.warn("Declaration does not have an initializer.");
				return;
			}

			if (!ts.isObjectLiteralExpression(declaration.initializer))
			{
				console.warn("Declaration initializer is not a valid object literal.");
				return;
			}

			const classType = this._getClassTypeFromDeclaration(declaration);

			if (!classType)
			{
				console.warn("Could not determine the class type from declaration.");
				return;
			}

			const properties = declaration.initializer.properties;

			properties.forEach((property) =>
			{
				if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name))
				{
					console.warn("Property is not a valid string:function assignment.");
					return;
				}

				const overrideName = property.name.text;
				const initializer = property.initializer;
				let func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined;
				let parameters: readonly ts.ParameterDeclaration[] | undefined;

				if (ts.isFunctionExpression(initializer) || ts.isArrowFunction(initializer) || ts.isFunctionDeclaration(initializer))
				{
					func = initializer;
					parameters = initializer.parameters;
				}

				if (!func || !parameters)
				{
					console.warn("Initializer is not a function expression, arrow function, or function declaration.");
					return;
				}

				if (parameters.length < 1 || parameters.length > 2)
				{
					console.warn("Function does not have 1 or 2 parameters.");
					return;
				}

				const signature = this._checker.getSignatureFromDeclaration(func);
				const returnType = signature ? this._checker.getReturnTypeOfSignature(signature) : undefined;

				if (!returnType || (returnType.flags & ts.TypeFlags.Void))
				{
					console.warn("Function does not have a return type.");
					return;
				}

				let leftType: ts.Type | PrimitiveType | undefined;
				let rightType: ts.Type | PrimitiveType | undefined;

				if (parameters.length === 1)
				{
					leftType = classType;
					const paramType = this._checker.getTypeAtLocation(parameters[0]);
					if (paramType)
					{
						leftType = classType;
						rightType = getPrimitiveTypeString(paramType) || paramType;
					}
					else
					{
						console.warn("Parameter type for single-parameter function is not correctly resolved.");
						return;
					}
				}
				else if (parameters.length === 2)
				{
					const param1Type = this._checker.getTypeAtLocation(parameters[0]);
					const param2Type = this._checker.getTypeAtLocation(parameters[1]);

					if (param1Type && param2Type)
					{
						if (!this._typeIsEqual(param1Type, classType) && !this._typeIsEqual(param2Type, classType))
						{
							console.warn("Neither parameter matches the class type.");
							return;
						}

						leftType = getPrimitiveTypeString(param1Type) || param1Type;
						rightType = getPrimitiveTypeString(param2Type) || param2Type;
					}
					else
					{
						console.warn("Failed to resolve one or both parameter types for two-parameter function.");
						return;
					}
				}

				if (leftType && rightType)
				{
					metadata.push(new OperatorOverrideMetadata(
						overrideName,
						leftType,
						rightType,
						func,
					));
				}
				else
				{
					console.warn("Failed to resolve both parameter types.");
				}
			});
		});

		return metadata;
	}

	/**
	 * Retrieves the TypeScript `ts.Type` of the class to which the provided property declaration belongs.
	 *
	 * @param declaration - The property declaration whose class type is to be determined.
	 * @returns The `ts.Type` representing the class or undefined if the class type can't be determined.
	 */
	private _getClassTypeFromDeclaration(declaration: ts.PropertyDeclaration): ts.Type | undefined
	{
		// Get the parent of the declaration
		const parentClass = declaration.parent;

		// Check if the parent is a class declaration
		if (ts.isClassDeclaration(parentClass) && parentClass.name)
		{
			// Use the type checker to get the type of the class
			const classType = this._checker.getTypeAtLocation(parentClass.name);
			return classType;
		}

		return undefined;
	}

	/**
	 * Compares two TypeScript types to determine if they are equivalent.
	 *
	 * @param typeA - The first TypeScript type to compare.
	 * @param typeB - The second TypeScript type to compare.
	 * @returns `true` if the types are considered equivalent, `false` otherwise.
	 */
	private _typeIsEqual(typeA: ts.Type, typeB: ts.Type): boolean
	{
		// Direct reference equality check
		if (typeA === typeB)
		{
			return true;
		}

		// Check if types are structurally equivalent
		if (this._checker.isTypeAssignableTo(typeA, typeB) && this._checker.isTypeAssignableTo(typeB, typeA))
		{
			return true;
		}

		return false;
	}
}
