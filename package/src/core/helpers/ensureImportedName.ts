import {
	type Symbol as AstSymbol,
	type SourceFile,
	SyntaxKind,
} from "ts-morph";
import { getImportedNameForSymbol } from "./getImportedNameForSymbol";

/**
 * Ensures that the specified symbol is imported into the source file.
 * If it is not already imported, adds it.
 *
 * @param sourceFile The SourceFile to modify.
 * @param symbol The AstSymbol representing the class to import.
 * @param moduleSpecifier The module from which the class should be imported.
 * @returns The imported identifier name to use in the source file.
 */
export const ensureImportedName = (
	sourceFile: SourceFile,
	symbol: AstSymbol,
	moduleSpecifier: string,
): string => {
	// Attempt to get the imported name if it already exists
	const existingName = getImportedNameForSymbol(sourceFile, symbol);
	if (existingName) return existingName; // Return the already-imported name

	// Generate a unique name for the new import
	const symbolName = symbol.getName();
	let newImportName = symbolName;

	// Ensure the name doesn't clash with existing identifiers in the source file
	const existingIdentifiers = sourceFile.getDescendantsOfKind(
		SyntaxKind.Identifier,
	);
	const existingNames = new Set(existingIdentifiers.map((id) => id.getText()));
	while (existingNames.has(newImportName)) {
		newImportName = `${symbolName}_${Math.random().toString(36).substr(2, 5)}`;
	}

	// Check if the module is already imported
	const existingImport = sourceFile
		.getImportDeclarations()
		.find(
			(importDecl) => importDecl.getModuleSpecifierValue() === moduleSpecifier,
		);

	if (existingImport) {
		// Add the new import to the named imports
		existingImport.addNamedImport(
			newImportName === symbolName
				? symbolName
				: { name: symbolName, alias: newImportName },
		);
	} else {
		// Add a new import declaration
		sourceFile.addImportDeclaration({
			moduleSpecifier,
			namedImports:
				newImportName === symbolName
					? [symbolName]
					: [{ name: symbolName, alias: newImportName }],
		});
	}

	return newImportName;
};
