import ts from "typescript";
import { ADD, DIVIDE, MULTIPLY, SUBTRACT } from "../lib";
import type { OperatorOverride } from "./types/OperatorOverride";
import type { OperatorName } from "./types/Operators";

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
		console.log("\tNum imports", importSymbols.length)

		// 3
		console.log("\nSTEP THREE: GET COMPUTED PROPERTY DECLARATION SYMBOLS IN FILE");
		const propDeclarationSymbols = this._getComputedPropertyDeclarations(sourceFile)
		console.log("\tNum property decs", propDeclarationSymbols.length)

		// 4. Trace prop dec symbols back to original file
		// to check they match something in `operatorSymbols`.
		// Filter out those that don't.
		console.log("\nSTEP FOUR: CHECK IF COMPUTED DECLARATION SYMBOLS EQUAL OPERATOR SYMBOLS");
		const operatorOverloadDeclarations = this._filterOperatorOverloadDeclarations(
			propDeclarationSymbols,
			importSymbols,
			Array.from(operatorSymbols.values())
		);
		console.log("\tNum valid symbols", operatorOverloadDeclarations.length)

		// 5. validate overloads
		console.log("\nSTEP FIVE: BUILD OPERATOR OVERLOAD METADATA");

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

		importDeclarations.forEach(importDeclaration => 
		{
			const importClause = importDeclaration.importClause;
			if (!importClause)
			{
				return;
			}

			// Named imports (import { ADD } from './module';)
			if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings))
			{
				importClause.namedBindings.elements.forEach(importSpecifier => 
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
	 * Retrieves the symbol for a property in a namespace symbol's export map.
	 * @param namespaceSymbol The symbol representing the namespace (e.g., `ops`).
	 * @param propertyName The property name whose symbol is being retrieved (e.g., `MULTIPLY`).
	 * @returns The symbol for the specified property if it exists, otherwise undefined.
	 */
	private _getExportedSymbol(namespaceSymbol: ts.Symbol, propertyName: ts.PropertyName): ts.Symbol | undefined 
	{
		// Ensure we have the exports map for the namespace symbol
		const exports = namespaceSymbol.exports;

		if (exports) 
		{
			// Check the type of propertyName and retrieve the appropriate symbol
			let propertyKey: ts.__String | undefined;
			if (ts.isIdentifier(propertyName)) 
			{
				propertyKey = propertyName.escapedText as ts.__String;
			}
			else if (ts.isStringLiteral(propertyName)) 
			{
				propertyKey = propertyName.text as ts.__String;
			}
			else if (ts.isNumericLiteral(propertyName)) 
			{
				propertyKey = propertyName.text as ts.__String; // Numeric literal text can be used as key
			}

			if (propertyKey) 
			{
				return exports.get(propertyKey);
			}
		}

		return undefined;
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

		propDeclarations.forEach(declaration => 
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
 * @param expression The property access expression, e.g., `ops.MULTIPLY`.
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




	private _isPropertyNameOperatorSymbol(
		expression: ts.Expression,
		importSymbols: ts.Symbol[],
		operatorSymbols: ts.Symbol[]
	)
		: boolean
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
}
