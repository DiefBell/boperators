import ts from "typescript";

/**
 * Gets the import symbols in the given file.
 */
export const getImportSymbolsInFile = (checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Symbol[] =>
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
				const symbol = checker.getSymbolAtLocation(importSpecifier.name);
				if (symbol)
				{
					importSymbols.push(symbol);
				}
			});
		}

		// Namespace imports (import * as ModuleName from './module';)
		else if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings))
		{
			const symbol = checker.getSymbolAtLocation(importClause.namedBindings.name);
			if (symbol)
			{
				importSymbols.push(symbol);
			}
		}

		// Default imports (import DefaultName from './module';)
		if (importClause.name)
		{
			const symbol = checker.getSymbolAtLocation(importClause.name);
			if (symbol)
			{
				importSymbols.push(symbol);
			}
		}
	});

	return importSymbols;
};
