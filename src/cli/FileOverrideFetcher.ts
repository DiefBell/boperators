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
		this._checker = program.getTypeChecker();

		// 2
		const importSymbols = this._getImportsFromOperatorFile(sourceFile);
		console.log("Num imports", importSymbols.length)

		// 3
		const propDeclarationSymbols = this._getPropertyDeclarationSymbols(sourceFile)
		console.log("Num property decs", propDeclarationSymbols.length)

		// 4. Trace prop dec symbols back to original file
		// to check they match something in `operatorSymbols`.
		// Filter out those that don't
		const validOperatorSymbols = this._filterValidOperatorSymbols(
			propDeclarationSymbols,
			importSymbols,
			Array.from(operatorSymbols.values())
		);
		console.log("Num valid symbols", validOperatorSymbols.length)

		// 5. trace imports back to original operators file to check if it's valid, filter
		// 6. validate overloads
		// 7. build overload metadata
		// 8. double check for clashes
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
	 * that have a computed property name, handling both
	 * direct identifiers and property access expressions.
	 * @param sourceFile 
	 * @returns 
	 */
	private _getPropertyDeclarationSymbols(
		sourceFile: ts.SourceFile
	): ts.Symbol[]
	{
		const declarations: ts.Symbol[] = [];

		const getPropertyDeclarationsFromNode = (node: ts.Node): void =>
		{
			if (ts.isPropertyDeclaration(node))
			{
				const name = node.name;
				if (ts.isComputedPropertyName(name))
				{
					const expression = name.expression;
					console.log(expression.getText());

					// Handle PropertyAccessExpression specifically for namespaced imports
					if (ts.isPropertyAccessExpression(expression))
					{
						// Get the symbol for the left side of the dot (namespace import)
						const leftSymbol = this._checker.getSymbolAtLocation(expression.expression);
						if (leftSymbol)
						{
							// Then get the member symbol from the right side
							const rightSymbol = leftSymbol.exports?.get(expression.name.escapedText as ts.__String);
							if (rightSymbol)
							{
								declarations.push(rightSymbol);
							}
						}
					}
					else 
					{
						const symbol = this._checker.getSymbolAtLocation(expression);
						if (symbol)
						{
							declarations.push(symbol);
						}
					}
				}
			}

			node.forEachChild(getPropertyDeclarationsFromNode);
		}

		getPropertyDeclarationsFromNode(sourceFile);
		return declarations;
	}

	/**
	 * Filters out any propDeclarationSymbols that aren't in importSymbols.
	 * Then filters out again if those import symbols don't alias to something in operatorSymbols.
	 * Must work with both NamedImports and NamespaceImports.
	 * 
	 * @param propDeclarationSymbols - Symbols for property declarations with computed names.
	 * @param importSymbols - Symbols imported into the current file, both named and namespace imports.
	 * @param operatorSymbols - Symbols from the original operator file to validate against.
	 * @returns An array of symbols that are valid operator symbols.
	 */
	private _filterValidOperatorSymbols(
		propDeclarationSymbols: ts.Symbol[],
		importSymbols: ts.Symbol[],
		operatorSymbols: ts.Symbol[]
	): ts.Symbol[] 
	{
		return propDeclarationSymbols.filter(propSymbol =>
		{
			// Check if propSymbol matches any of the import symbols.
			const matchingImport = importSymbols.find(importSymbol =>
			{
				console.log("\nProp symbol:", propSymbol.getName());
				console.log("Import symbol:", importSymbol.getName())
				// Compare directly or get alias and compare.
				return importSymbol === propSymbol || this._checker.getAliasedSymbol(importSymbol) === propSymbol;
			});

			// If there's no matching import, filter out.
			if (!matchingImport) 
			{
				console.log("No match :(");
				return false;
			}
			console.log("Match :)");

			// Check if the matching import symbol or its alias is in operatorSymbols.
			const aliasedSymbol = this._checker.getAliasedSymbol(matchingImport);
			return operatorSymbols.includes(aliasedSymbol);
		});
	}
}
