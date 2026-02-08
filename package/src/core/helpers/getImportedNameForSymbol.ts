import type { Symbol as AstSymbol, SourceFile } from "ts-morph";

/**
 * Checks if the given symbol is already imported in the SourceFile.
 * @param sourceFile The SourceFile to search for imports.
 * @param symbol The AstSymbol to match against imports.
 * @returns The imported identifier name if found, otherwise undefined.
 */
export const getImportedNameForSymbol = (
	sourceFile: SourceFile,
	symbol: AstSymbol,
): string | undefined => {
	const aliasedSymbol = symbol.getAliasedSymbol() ?? symbol;

	// Helper function to compare symbols by their declarations
	const symbolsAreEquivalent = (
		a: AstSymbol | undefined,
		b: AstSymbol | undefined,
	): boolean => {
		if (!a || !b) return false;
		const aDecls = a.getDeclarations();
		const bDecls = b.getDeclarations();
		if (aDecls.length !== bDecls.length) return false;
		return aDecls.every(
			(aDecl, i) =>
				aDecl.getSourceFile() === bDecls[i].getSourceFile() &&
				aDecl.getStart() === bDecls[i].getStart(),
		);
	};

	// Get all import declarations in the source file
	const importDeclarations = sourceFile.getImportDeclarations();

	for (const importDecl of importDeclarations) {
		// Named imports
		const namedImports = importDecl.getNamedImports();
		for (const namedImport of namedImports) {
			const importedSymbol = namedImport.getSymbol();
			if (
				symbolsAreEquivalent(importedSymbol?.getAliasedSymbol(), aliasedSymbol)
			) {
				return (
					namedImport.getAliasNode()?.getText() ??
					namedImport.getNameNode().getText()
				);
			}
		}

		// Default import
		const defaultImport = importDecl.getDefaultImport();
		if (defaultImport) {
			const defaultSymbol = defaultImport.getSymbol()?.getAliasedSymbol();
			if (symbolsAreEquivalent(defaultSymbol, aliasedSymbol)) {
				// Return the default import name
				return defaultImport.getText();
			}
		}

		// Check namespace imports
		const namespaceImport = importDecl.getNamespaceImport();
		if (namespaceImport) {
			const namespaceSymbol = namespaceImport.getSymbol();
			if (namespaceSymbol) {
				// Look for the symbol under this namespace
				const exports = namespaceSymbol.getAliasedSymbol()?.getExports() ?? [];
				for (const exportedSymbol of exports) {
					const resolvedExportedSymbol =
						exportedSymbol.getAliasedSymbol() ?? exportedSymbol;
					if (symbolsAreEquivalent(resolvedExportedSymbol, aliasedSymbol)) {
						// Return namespace-qualified name (e.g., v3.Vector3)
						return `${namespaceImport.getText()}.${exportedSymbol.getName()}`;
					}
				}
			}
		}
	}

	// No matching import found
	return undefined;
};
