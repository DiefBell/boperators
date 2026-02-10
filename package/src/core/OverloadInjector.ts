import {
	SourceFile,
	SyntaxKind,
	type Project as TsMorphProject,
} from "ts-morph";
import { ensureImportedName } from "./helpers/ensureImportedName";
import { getModuleSpecifier } from "./helpers/getModuleSpecifier";
import { resolveExpressionType } from "./helpers/resolveExpressionType";
import type { OverloadStore } from "./OverloadStore";
import {
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
} from "./operatorMap";
import { SourceMap } from "./SourceMap";

export type TransformResult = {
	/** The mutated ts-morph SourceFile (same reference as input). */
	sourceFile: SourceFile;
	/** The full text after transformation. */
	text: string;
	/** Bidirectional source map between original and transformed text. */
	sourceMap: SourceMap;
};

export class OverloadInjector {
	constructor(
		/**
		 * TS Morph project.
		 */
		private readonly _project: TsMorphProject,
		/**
		 * Overload store.
		 */
		private readonly _overloadStore: OverloadStore,
	) {}

	public overloadFile(file: string | SourceFile): TransformResult {
		const sourceFile =
			file instanceof SourceFile
				? file
				: this._project.getSourceFileOrThrow(file);

		const originalText = sourceFile.getFullText();

		// Process one innermost binary expression per iteration,
		// re-fetching descendants each time so types resolve correctly
		// after each transformation and AST references stay fresh.
		let changed = true;
		while (changed) {
			changed = false;
			// Reverse DFS pre-order → innermost expressions first
			const binaryExpressions = sourceFile
				.getDescendantsOfKind(SyntaxKind.BinaryExpression)
				.reverse();

			for (const expression of binaryExpressions) {
				const operatorKind = expression.getOperatorToken().getKind();
				if (!isOperatorSyntaxKind(operatorKind)) continue;

				const lhs = expression.getLeft();
				const leftType = resolveExpressionType(lhs);

				const rhs = expression.getRight();
				const rightType = resolveExpressionType(rhs);

				const overloadDesc = this._overloadStore.findOverload(
					operatorKind,
					leftType,
					rightType,
				);
				if (!overloadDesc) continue;

				const {
					className: classNameRaw,
					classFilePath,
					operatorString,
					index,
					isStatic,
				} = overloadDesc;

				// Look up the fresh ClassDeclaration from the project
				const classSourceFile =
					this._project.getSourceFileOrThrow(classFilePath);
				const classDecl = classSourceFile.getClassOrThrow(classNameRaw);

				// Ensure class is imported, get its textual name
				const classModuleSpecifier = getModuleSpecifier(
					sourceFile,
					classSourceFile,
				);
				const className = ensureImportedName(
					sourceFile,
					classDecl.getSymbol()!,
					classModuleSpecifier,
				);

				// Build the text code to replace the binary operator with the overload call
				const overloadCall = isStatic
					? `${className}["${operatorString}"][${index}](${lhs.getText()}, ${rhs.getText()})`
					: `${lhs.getText()}["${operatorString}"][${index}].call(${lhs.getText()}, ${rhs.getText()})`;

				expression.replaceWithText(overloadCall);
				changed = true;
				break; // re-fetch descendants after each mutation
			}
		}

		// Process prefix unary expressions (-x, +x, !x, ~x)
		changed = true;
		while (changed) {
			changed = false;
			const prefixExpressions = sourceFile
				.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)
				.reverse();

			for (const expression of prefixExpressions) {
				const operatorKind = expression.getOperatorToken();
				if (!isPrefixUnaryOperatorSyntaxKind(operatorKind)) continue;

				const operand = expression.getOperand();
				const operandType = resolveExpressionType(operand);

				const overloadDesc = this._overloadStore.findPrefixUnaryOverload(
					operatorKind,
					operandType,
				);
				if (!overloadDesc) continue;

				const {
					className: classNameRaw,
					classFilePath,
					operatorString,
					index,
				} = overloadDesc;

				const classSourceFile =
					this._project.getSourceFileOrThrow(classFilePath);
				const classDecl = classSourceFile.getClassOrThrow(classNameRaw);

				const classModuleSpecifier = getModuleSpecifier(
					sourceFile,
					classSourceFile,
				);
				const className = ensureImportedName(
					sourceFile,
					classDecl.getSymbol()!,
					classModuleSpecifier,
				);

				const overloadCall = `${className}["${operatorString}"][${index}](${operand.getText()})`;

				expression.replaceWithText(overloadCall);
				changed = true;
				break;
			}
		}

		// Process postfix unary expressions (x++, x--)
		changed = true;
		while (changed) {
			changed = false;
			const postfixExpressions = sourceFile
				.getDescendantsOfKind(SyntaxKind.PostfixUnaryExpression)
				.reverse();

			for (const expression of postfixExpressions) {
				const operatorKind = expression.getOperatorToken();
				if (!isPostfixUnaryOperatorSyntaxKind(operatorKind)) continue;

				const operand = expression.getOperand();
				const operandType = resolveExpressionType(operand);

				const overloadDesc = this._overloadStore.findPostfixUnaryOverload(
					operatorKind,
					operandType,
				);
				if (!overloadDesc) continue;

				const { operatorString, index } = overloadDesc;

				const overloadCall = `${operand.getText()}["${operatorString}"][${index}].call(${operand.getText()})`;

				expression.replaceWithText(overloadCall);
				changed = true;
				break;
			}
		}

		const text = sourceFile.getFullText();
		const sourceMap = new SourceMap(originalText, text);

		return { sourceFile, text, sourceMap };
	}
}
