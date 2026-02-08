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
			else if (leftType === "any")
			{
				// Type resolution can fail for compound assignments (+=, *=, etc.)
				// because TS tries to compute the result type of the underlying
				// binary operation, which it can't do for overloaded types.
				// Fall back to the declared type of the symbol.
				const decl = lhs.getSymbol()?.getValueDeclaration();
				if (decl) leftType = decl.getType().getText();
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
			else if (rightType === "any")
			{
				const decl = rhs.getSymbol()?.getValueDeclaration();
				if (decl) rightType = decl.getType().getText();
			}

			const overloadsForOperator = this._overloadStore.get(operatorKind);
			if (!overloadsForOperator) return;

			const overloadsForLhs = overloadsForOperator.get(leftType);
			if (!overloadsForLhs) return;

			const overloadDesc = overloadsForLhs.get(rightType);
			if (!overloadDesc) return;

			const { className: classNameRaw, classFilePath, operatorString, index, isStatic } = overloadDesc;

			// Look up the fresh ClassDeclaration from the project
			const classSourceFile = this._project.getSourceFileOrThrow(classFilePath);
			const classDecl = classSourceFile.getClassOrThrow(classNameRaw);

			// Ensure class is imported, get its textual name
			const classModuleSpecifier = getModuleSpecifier(sourceFile, classSourceFile);
			const className = ensureImportedName(sourceFile, classDecl.getSymbol()!, classModuleSpecifier);

			// Build the text code to replace the binary operator with the overload call
			const overloadCall = isStatic
				? `${className}["${operatorString}"][${index}](${lhs.getText()}, ${rhs.getText()})`
				: `${lhs.getText()}["${operatorString}"][${index}].call(${lhs.getText()}, ${rhs.getText()})`;

			expression.replaceWithText(overloadCall);
		});

		return sourceFile;
	}
}
