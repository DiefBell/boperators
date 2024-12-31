import { SyntaxKind, type Project as TsMorphProject } from "ts-morph";
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

	public overloadFile(filePath: string)
	{
		const sourceFile = this._project.getSourceFileOrThrow(filePath);

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
	}
}
