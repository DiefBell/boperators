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
		this._checker = program.getTypeChecker();
		const imports = this._getImportsFromOperatorFile(sourceFile);
		const methods = this._getStaticPropertyDeclarations(sourceFile, imports)
		// find methods with names matching imports
		// trace imports back to original operators file to check if it's valid, filter
		// validate overloads
		// build overload metadata
		// double check for clashes
	}

	/**
     * Gets all of the symbols that are imports from the operators file.
     * @param sourceFile 
     * @returns 
     */
    private _getImportsFromOperatorFile(sourceFile: ts.SourceFile): ts.Symbol[] {
        const importSymbols: ts.Symbol[] = [];
        const importDeclarations = sourceFile.statements.filter(ts.isImportDeclaration);

        importDeclarations.forEach(importDeclaration => {
            const importClause = importDeclaration.importClause;
            if(!importClause) {
                return;
            }

            // Named imports (import { ADD } from './module';)
            if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
                importClause.namedBindings.elements.forEach(importSpecifier => {
                    const symbol = this._checker.getSymbolAtLocation(importSpecifier.name);
                    if (symbol) {
                        importSymbols.push(symbol);
                    }
                });
            }

            // Namespace imports (import * as ModuleName from './module';)
            else if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
                const symbol = this._checker.getSymbolAtLocation(importClause.namedBindings.name);
                if (symbol) {
                    importSymbols.push(symbol);
                }
            }

            // Default imports (import DefaultName from './module';)
            if (importClause.name) {
                const symbol = this._checker.getSymbolAtLocation(importClause.name);
                if (symbol) {
                    importSymbols.push(symbol);
                }
            }
        });

        return importSymbols;
    }

	private _getStaticPropertyDeclarations(
		sourceFile: ts.SourceFile,
		operatorSymbols: ts.Symbol[]
	)
	: ts.PropertyDeclaration[]
	{
		const declarations: ts.PropertyDeclaration[] = [];

		const getPropertyDeclarationsFromNode = (node: ts.Node): void =>
		{
			if(ts.isPropertyDeclaration(node))
			{
				const name = node.name;
				if(ts.isIdentifier(name)) {
					console.log(name.getText());
					declarations.push(node);
				}
			}

			node.forEachChild(getPropertyDeclarationsFromNode);
		}

		getPropertyDeclarationsFromNode(sourceFile);
		return declarations;
	}

	// private _filterByOperatorSymbols
}