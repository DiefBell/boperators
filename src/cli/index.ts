import * as path from "path";
import {
	Project as TsMorphProject,
	SyntaxKind,
	type SourceFile,
	type Symbol as AstSymbol,
} from "ts-morph";
import { OverloadStore } from "./OverloadStore";
import { isOperatorSyntaxKind } from "./operatorMap";
import { ErrorManager } from "./ErrorManager";

const testFilesRoot = path.join(
	import.meta.dir,
	"..", // src
	"..", // .
	"test"
);
const testFiles = [
	path.join(testFilesRoot, "Vector3.ts"),
	path.join(testFilesRoot, "test.ts"),
	// uncomment this to check error logging is working correctly
	// path.join(testFilesRoot, "BadVector3.ts"),
];

const project = new TsMorphProject();
project.addSourceFilesAtPaths(testFiles);

const errorManager = new ErrorManager(
	process.argv.includes("--error-on-warning")
);
const overloadStore = new OverloadStore(project, errorManager);
errorManager.throwIfErrorsElseLogWarnings();

// Process the test.ts file
const testFile = project.getSourceFileOrThrow(testFiles[1]);

const binaryExpressions = testFile.getDescendantsOfKind(
	SyntaxKind.BinaryExpression
);

/**
 * Checks if the given symbol is already imported in the SourceFile.
 * @param sourceFile The SourceFile to search for imports.
 * @param symbol The AstSymbol to match against imports.
 * @returns The imported identifier name if found, otherwise undefined.
 */
const getImportedNameForSymbol = (sourceFile: SourceFile, symbol: AstSymbol): string | undefined =>
{
	const aliasedSymbol = symbol.getAliasedSymbol() ?? symbol;

	// Helper function to compare symbols by their declarations
	const symbolsAreEquivalent = (a: AstSymbol | undefined, b: AstSymbol | undefined): boolean =>
	{
		if (!a || !b) return false;
		const aDecls = a.getDeclarations();
		const bDecls = b.getDeclarations();
		if (aDecls.length !== bDecls.length) return false;
		return aDecls.every((aDecl, i) => aDecl.getSourceFile() === bDecls[i].getSourceFile()
			&& aDecl.getStart() === bDecls[i].getStart());
	};

	// Get all import declarations in the source file
	const importDeclarations = sourceFile.getImportDeclarations();

	for (const importDecl of importDeclarations)
	{
		// Named imports
		const namedImports = importDecl.getNamedImports();
		for (const namedImport of namedImports)
		{
			const importedSymbol = namedImport.getSymbol();
			if (symbolsAreEquivalent(importedSymbol?.getAliasedSymbol(), aliasedSymbol))
			{
				return namedImport.getAliasNode()?.getText() ?? namedImport.getNameNode().getText();
			}
		}

		// Default import
		const defaultImport = importDecl.getDefaultImport();
		if (defaultImport)
		{
			const defaultSymbol = defaultImport.getSymbol()?.getAliasedSymbol();
			if (symbolsAreEquivalent(defaultSymbol, aliasedSymbol))
			{
				// Return the default import name
				return defaultImport.getText();
			}
		}

		// Check namespace imports
		const namespaceImport = importDecl.getNamespaceImport();
		if (namespaceImport)
		{
			const namespaceSymbol = namespaceImport.getSymbol();
			if (namespaceSymbol)
			{
				// Look for the symbol under this namespace
				const exports = namespaceSymbol.getAliasedSymbol()?.getExports() ?? [];
				for (const exportedSymbol of exports)
				{
					const resolvedExportedSymbol = exportedSymbol.getAliasedSymbol() ?? exportedSymbol;
					if (symbolsAreEquivalent(resolvedExportedSymbol, aliasedSymbol))
					{
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

/**
 * Ensures that the specified symbol is imported into the source file.
 * If it is not already imported, adds it.
 *
 * @param sourceFile The SourceFile to modify.
 * @param symbol The AstSymbol representing the class to import.
 * @param moduleSpecifier The module from which the class should be imported.
 * @returns The imported identifier name to use in the source file.
 */
const ensureImportedName = (sourceFile: SourceFile, symbol: AstSymbol, moduleSpecifier: string): string =>
{
	// Attempt to get the imported name if it already exists
	const existingName = getImportedNameForSymbol(sourceFile, symbol);
	if (existingName) return existingName; // Return the already-imported name

	// Generate a unique name for the new import
	const symbolName = symbol.getName();
	let newImportName = symbolName;

	// Ensure the name doesn't clash with existing identifiers in the source file
	const existingIdentifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
	const existingNames = new Set(existingIdentifiers.map((id) => id.getText()));
	while (existingNames.has(newImportName))
	{
		newImportName = `${symbolName}_${Math.random().toString(36).substr(2, 5)}`;
	}

	// Check if the module is already imported
	const existingImport = sourceFile.getImportDeclarations().find(
		(importDecl) => importDecl.getModuleSpecifierValue() === moduleSpecifier
	);

	if (existingImport)
	{
		// Add the new import to the named imports
		existingImport.addNamedImport(newImportName === symbolName ? symbolName : { name: symbolName, alias: newImportName });
	}
	else
	{
		// Add a new import declaration
		sourceFile.addImportDeclaration({
			moduleSpecifier,
			namedImports: newImportName === symbolName ? [symbolName] : [{ name: symbolName, alias: newImportName }],
		});
	}

	return newImportName;
};

function getModuleSpecifier(fromFile: SourceFile, toFile: SourceFile): string
{
	const fromDir = path.dirname(fromFile.getFilePath());
	const toPath = toFile.getFilePath();
	const relativePath = path.relative(fromDir, toPath);
	// Ensure the path uses './' if it's a relative path
	return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

binaryExpressions.forEach((expression) =>
{
	const operatorKind = expression.getOperatorToken().getKind();
	if (!isOperatorSyntaxKind(operatorKind))
	{
		return; // Not an operator we care about
	}

	const lhs = expression.getLeft();
	let leftType = lhs.getType().getText();
	if (lhs.getKind() === SyntaxKind.NumericLiteral)
	{
		leftType = "number";
	}

	const rhs = expression.getRight();
	let rightType = rhs.getType().getText();
	if (rhs.getKind() === SyntaxKind.NumericLiteral)
	{
		rightType = "number";
	}
	else if (
		rhs.getKind() !== SyntaxKind.StringLiteral
		&& (rightType === "true" || rightType === "false")
	)
	{
		rightType = "boolean";
	}

	const overloadsForOperator = overloadStore.get(operatorKind);
	if (!overloadsForOperator) return;

	const overloadsForLhs = overloadsForOperator.get(leftType);
	if (!overloadsForLhs) return;

	const overloadDesc = overloadsForLhs.get(rightType);
	if (!overloadDesc) return;

	const { classDecl, propIdentifier, index, isStatic } = overloadDesc;

	// Ensure class is imported, get its textual name
	const classSymbol = classDecl.getSymbol()!;
	const aliasedClassSymbol = classSymbol.getAliasedSymbol() ?? classSymbol;

	const classSourceFile = aliasedClassSymbol?.getDeclarations()?.[0]?.getSourceFile();
	if (!classSourceFile) throw new Error("Failed to determine source file for class.");

	const classModuleSpecifier = getModuleSpecifier(testFile, classSourceFile);
	const className = ensureImportedName(testFile, classDecl.getSymbol()!, classModuleSpecifier);

	// Ensure operator Symbol is imported, get its textual name
	const propSymbol = propIdentifier.getSymbol()!;
	const aliasedPropSymbol = propSymbol.getAliasedSymbol() ?? propSymbol;

	const propSourceFile = aliasedPropSymbol.getDeclarations()?.[0]?.getSourceFile();
	if (!propSourceFile) throw new Error("Failed to determine source file for property Symbol.");

	const propModuleSpecifier = getModuleSpecifier(testFile, propSourceFile);
	const propName = ensureImportedName(testFile, propIdentifier.getSymbol()!, propModuleSpecifier);

	// Build the text code to replace the binary operator with the overload call
	const overloadCall = isStatic
		? `${className}[${propName}][${index}](${lhs.getText()}, ${rhs.getText()})`
		: `${lhs.getText()}[${propName}][${index}](${rhs.getText()})`;

	expression.replaceWithText(overloadCall);
});

// Print the modified content to the console
console.log(testFile.getFullText());
