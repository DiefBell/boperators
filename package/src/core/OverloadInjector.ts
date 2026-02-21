import path from "node:path";
import {
	SourceFile,
	SyntaxKind,
	type Project as TsMorphProject,
} from "ts-morph";
import type { BopLogger } from "./BopConfig";
import { ensureImportedName } from "./helpers/ensureImportedName";
import { getModuleSpecifier } from "./helpers/getModuleSpecifier";
import { resolveExpressionType } from "./helpers/resolveExpressionType";
import type { OverloadStore } from "./OverloadStore";
import {
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
} from "./operatorMap";
import { computeEdits, type EditRecord } from "./SourceMap";

export type TransformResult = {
	/** The mutated ts-morph SourceFile (same reference as input). */
	sourceFile: SourceFile;
	/** The full text after transformation. */
	text: string;
	/** Edit records mapping positions between original and transformed text. */
	edits: readonly EditRecord[];
};

export class OverloadInjector {
	private readonly _logger: BopLogger;

	constructor(
		/**
		 * TS Morph project.
		 */
		private readonly _project: TsMorphProject,
		/**
		 * Overload store.
		 */
		private readonly _overloadStore: OverloadStore,
		logger: BopLogger,
	) {
		this._logger = logger;
	}

	public overloadFile(file: string | SourceFile): TransformResult {
		const sourceFile =
			file instanceof SourceFile
				? file
				: this._project.getSourceFileOrThrow(file);

		const fileName = path.basename(sourceFile.getFilePath());
		const originalText = sourceFile.getFullText();
		let transformCount = 0;

		// Outer loop: re-run all three passes until the file is fully stable.
		// This is necessary because transforming a unary expression can unblock
		// a binary expression (e.g. in `-v1 + v2`, the unary `-` must be
		// replaced first so TypeScript can resolve its return type; the binary
		// `+` overload then becomes matchable on the next outer iteration).
		let outerChanged = true;
		while (outerChanged) {
			outerChanged = false;

			// ── Binary expressions ────────────────────────────────────────────
			// Process one innermost expression per inner iteration, re-fetching
			// descendants each time so types resolve correctly after each
			// transformation and AST references stay fresh.
			let changed = true;
			while (changed) {
				changed = false;
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
					const classSymbol = classDecl.getSymbol();
					if (!classSymbol)
						throw new Error(`No symbol for class "${classNameRaw}"`);
					const classModuleSpecifier = getModuleSpecifier(
						sourceFile,
						classSourceFile,
					);
					const className = ensureImportedName(
						sourceFile,
						classSymbol,
						classModuleSpecifier,
					);

					// Build the text code to replace the binary operator with the overload call
					const overloadCall = isStatic
						? `${className}["${operatorString}"][${index}](${lhs.getText()}, ${rhs.getText()})`
						: `${lhs.getText()}["${operatorString}"][${index}].call(${lhs.getText()}, ${rhs.getText()})`;

					this._logger.debug(
						`${fileName}: ${expression.getText()} => ${overloadCall}`,
					);
					expression.replaceWithText(overloadCall);
					transformCount++;
					changed = true;
					outerChanged = true;
					break; // re-fetch descendants after each mutation
				}
			}

			// ── Prefix unary expressions (-x, +x, !x, ~x) ───────────────────
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

					const classSymbol = classDecl.getSymbol();
					if (!classSymbol)
						throw new Error(`No symbol for class "${classNameRaw}"`);
					const classModuleSpecifier = getModuleSpecifier(
						sourceFile,
						classSourceFile,
					);
					const className = ensureImportedName(
						sourceFile,
						classSymbol,
						classModuleSpecifier,
					);

					const overloadCall = `${className}["${operatorString}"][${index}](${operand.getText()})`;

					this._logger.debug(
						`${fileName}: ${expression.getText()} => ${overloadCall}`,
					);
					expression.replaceWithText(overloadCall);
					transformCount++;
					changed = true;
					outerChanged = true;
					break;
				}
			}

			// ── Postfix unary expressions (x++, x--) ─────────────────────────
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

					this._logger.debug(
						`${fileName}: ${expression.getText()} => ${overloadCall}`,
					);
					expression.replaceWithText(overloadCall);
					transformCount++;
					changed = true;
					outerChanged = true;
					break;
				}
			}
		}

		if (transformCount > 0) {
			this._logger.debug(
				`${fileName}: ${transformCount} expression${transformCount === 1 ? "" : "s"} transformed`,
			);
		}

		const text = sourceFile.getFullText();
		const edits = computeEdits(originalText, text);

		return { sourceFile, text, edits };
	}
}
