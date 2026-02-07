import { SourceFile, SyntaxKind, type Project as TsMorphProject } from "ts-morph";
import type { OverloadStore } from "./OverloadStore";
import { isOperatorSyntaxKind } from "./operatorMap";
import { getModuleSpecifier } from "./helpers/getModuleSpecifier";
import { ensureImportedName } from "./helpers/ensureImportedName";

export class OverloadInjector
{
	constructor(
		/**
		 * TS Morph project.
		 */
		private readonly _project: TsMorphProject,
		/**
		 * Overload store.
		 */
		private readonly _overloadStore: OverloadStore
	)
	{
	}

	/**
	 * Replaces all references to operator symbols (e.g., `PLUS`, `MULTIPLY`) with
	 * string keys (e.g., `"__bop_PLUS"`), and removes the now-unused imports.
	 * This makes the transformed code standalone with no runtime dependency on boperators.
	 */
	public replaceSymbolReferences(file: string | SourceFile): SourceFile
	{
		const sourceFile = file instanceof SourceFile ? file : this._project.getSourceFileOrThrow(file);

		// Replace all identifier references to operator symbols (outside of import declarations)
		const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
		for (let i = identifiers.length - 1; i >= 0; i--)
		{
			const id = identifiers[i];

			// Skip identifiers inside import declarations
			if (id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;

			const symbol = id.getSymbol();
			if (!symbol) continue;

			if (!this._overloadStore.isOperatorSymbol(symbol)) continue;

			const resolved = symbol.getAliasedSymbol() ?? symbol;
			id.replaceWithText(`"__bop_${resolved.getName()}"`);
		}

		// Remove operator symbol imports
		const importDecls = sourceFile.getImportDeclarations();
		for (let i = importDecls.length - 1; i >= 0; i--)
		{
			const importDecl = importDecls[i];
			const namedImports = importDecl.getNamedImports();

			for (let j = namedImports.length - 1; j >= 0; j--)
			{
				const namedImport = namedImports[j];
				const symbol = namedImport.getSymbol();
				if (!symbol) continue;

				if (this._overloadStore.isOperatorSymbol(symbol))
				{
					namedImport.remove();
				}
			}

			// Remove the entire import declaration if no imports remain
			if (
				importDecl.getNamedImports().length === 0
				&& !importDecl.getDefaultImport()
				&& !importDecl.getNamespaceImport()
			)
			{
				importDecl.remove();
			}
		}

		return sourceFile;
	}

	public overloadFile(file: string | SourceFile): SourceFile
	{
		const sourceFile = file instanceof SourceFile ? file : this._project.getSourceFileOrThrow(file);

		const binaryExpressions = sourceFile.getDescendantsOfKind(
			SyntaxKind.BinaryExpression
		);

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

			const overloadsForOperator = this._overloadStore.get(operatorKind);
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

			const classModuleSpecifier = getModuleSpecifier(sourceFile, classSourceFile);
			const className = ensureImportedName(sourceFile, classDecl.getSymbol()!, classModuleSpecifier);

			// Ensure operator Symbol is imported, get its textual name
			const propSymbol = propIdentifier.getSymbol()!;
			const aliasedPropSymbol = propSymbol.getAliasedSymbol() ?? propSymbol;

			const propSourceFile = aliasedPropSymbol.getDeclarations()?.[0]?.getSourceFile();
			if (!propSourceFile) throw new Error("Failed to determine source file for property Symbol.");

			const propModuleSpecifier = getModuleSpecifier(sourceFile, propSourceFile);
			const propName = ensureImportedName(sourceFile, propIdentifier.getSymbol()!, propModuleSpecifier);

			// Build the text code to replace the binary operator with the overload call
			const overloadCall = isStatic
				? `${className}[${propName}][${index}](${lhs.getText()}, ${rhs.getText()})`
				: `${lhs.getText()}[${propName}][${index}](${rhs.getText()})`;

			expression.replaceWithText(overloadCall);
		});

		return sourceFile;
	}
}
