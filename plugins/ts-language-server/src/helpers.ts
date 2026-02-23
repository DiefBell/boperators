import {
	getOperatorStringFromMethod,
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
	Node,
	type OverloadStore,
	resolveExpressionType,
	SyntaxKind,
	type Project as TsMorphProject,
	type SourceFile as TsMorphSourceFile,
} from "boperators";
import type tsRuntime from "typescript/lib/tsserverlibrary";

// ----- Types -----

export type OverloadEditInfo = {
	/** Start of the operator token in the original source */
	operatorStart: number;
	/** End of the operator token in the original source */
	operatorEnd: number;
	/** Start of the hover hit-test area (includes surrounding whitespace) */
	hoverStart: number;
	/** End of the hover hit-test area (includes surrounding whitespace) */
	hoverEnd: number;
	/** Start of the full expression in the original source */
	exprStart: number;
	/** End of the full expression in the original source */
	exprEnd: number;
	className: string;
	classFilePath: string;
	operatorString: string;
	returnType: string;
	/** LHS type (binary overloads only) */
	lhsType?: string;
	/** RHS type (binary overloads only) */
	rhsType?: string;
	/** Operand type (unary overloads only) */
	operandType?: string;
	isStatic: boolean;
	kind: "binary" | "prefixUnary" | "postfixUnary";
};

// ----- Internal helpers -----

/**
 * Recursively resolve the effective type of an expression, accounting for
 * operator overloads. For sub-expressions that match a registered overload,
 * uses the overload's declared return type instead of what TypeScript infers
 * (since TS doesn't know about operator overloading).
 */
function resolveOverloadedType(
	node: Node,
	overloadStore: OverloadStore,
): string {
	if (Node.isParenthesizedExpression(node)) {
		return resolveOverloadedType(node.getExpression(), overloadStore);
	}

	if (Node.isBinaryExpression(node)) {
		const operatorKind = node.getOperatorToken().getKind();
		if (isOperatorSyntaxKind(operatorKind)) {
			const leftType = resolveOverloadedType(node.getLeft(), overloadStore);
			const rightType = resolveOverloadedType(node.getRight(), overloadStore);
			const overload = overloadStore.findOverload(
				operatorKind,
				leftType,
				rightType,
			);
			if (overload) return overload.returnType;
		}
	}

	if (Node.isPrefixUnaryExpression(node)) {
		const operatorKind = node.getOperatorToken();
		if (isPrefixUnaryOperatorSyntaxKind(operatorKind)) {
			const operandType = resolveOverloadedType(
				node.getOperand(),
				overloadStore,
			);
			const overload = overloadStore.findPrefixUnaryOverload(
				operatorKind,
				operandType,
			);
			if (overload) return overload.returnType;
		}
	}

	if (Node.isPostfixUnaryExpression(node)) {
		const operatorKind = node.getOperatorToken();
		if (isPostfixUnaryOperatorSyntaxKind(operatorKind)) {
			const operandType = resolveOverloadedType(
				node.getOperand(),
				overloadStore,
			);
			const overload = overloadStore.findPostfixUnaryOverload(
				operatorKind,
				operandType,
			);
			if (overload) return overload.returnType;
		}
	}

	return resolveExpressionType(node);
}

// ----- Exported helpers -----

/**
 * Before transformation, find all expressions (binary, prefix unary, postfix unary)
 * that match registered overloads and record their operator token positions.
 * This is used to provide hover info for overloaded operators.
 */
export function findOverloadEdits(
	sourceFile: TsMorphSourceFile,
	overloadStore: OverloadStore,
): OverloadEditInfo[] {
	const edits: OverloadEditInfo[] = [];
	const binaryExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.BinaryExpression,
	);

	for (const expression of binaryExpressions) {
		const operatorToken = expression.getOperatorToken();
		const operatorKind = operatorToken.getKind();

		if (!isOperatorSyntaxKind(operatorKind)) continue;

		const leftType = resolveOverloadedType(expression.getLeft(), overloadStore);
		const rightType = resolveOverloadedType(
			expression.getRight(),
			overloadStore,
		);

		const overloadDesc = overloadStore.findOverload(
			operatorKind,
			leftType,
			rightType,
		);
		if (!overloadDesc) continue;

		edits.push({
			operatorStart: operatorToken.getStart(),
			operatorEnd: operatorToken.getEnd(),
			hoverStart: expression.getLeft().getEnd(),
			hoverEnd: expression.getRight().getStart(),
			exprStart: expression.getStart(),
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			returnType: overloadDesc.returnType,
			lhsType: leftType,
			rhsType: rightType,
			isStatic: overloadDesc.isStatic,
			kind: "binary",
		});
	}

	// Scan prefix unary expressions
	const prefixExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.PrefixUnaryExpression,
	);
	for (const expression of prefixExpressions) {
		const operatorKind = expression.getOperatorToken();
		if (!isPrefixUnaryOperatorSyntaxKind(operatorKind)) continue;

		const operandType = resolveOverloadedType(
			expression.getOperand(),
			overloadStore,
		);
		const overloadDesc = overloadStore.findPrefixUnaryOverload(
			operatorKind,
			operandType,
		);
		if (!overloadDesc) continue;

		const exprStart = expression.getStart();
		const operand = expression.getOperand();

		edits.push({
			operatorStart: exprStart,
			operatorEnd: operand.getStart(),
			hoverStart: exprStart,
			hoverEnd: operand.getStart(),
			exprStart,
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			returnType: overloadDesc.returnType,
			operandType: operandType,
			isStatic: overloadDesc.isStatic,
			kind: "prefixUnary",
		});
	}

	// Scan postfix unary expressions
	const postfixExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.PostfixUnaryExpression,
	);
	for (const expression of postfixExpressions) {
		const operatorKind = expression.getOperatorToken();
		if (!isPostfixUnaryOperatorSyntaxKind(operatorKind)) continue;

		const operandType = resolveOverloadedType(
			expression.getOperand(),
			overloadStore,
		);
		const overloadDesc = overloadStore.findPostfixUnaryOverload(
			operatorKind,
			operandType,
		);
		if (!overloadDesc) continue;

		const operand = expression.getOperand();
		const operatorStart = operand.getEnd();

		edits.push({
			operatorStart,
			operatorEnd: expression.getEnd(),
			hoverStart: operatorStart,
			hoverEnd: expression.getEnd(),
			exprStart: expression.getStart(),
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			returnType: overloadDesc.returnType,
			operandType: operandType,
			isStatic: overloadDesc.isStatic,
			kind: "postfixUnary",
		});
	}

	return edits;
}

/**
 * Strip fully-qualified import paths from a type name so that
 * `import("/path/to/Vec2").Vec2` is displayed as just `Vec2`.
 */
export function simplifyTypeName(typeName: string): string {
	return typeName.replace(/\bimport\("[^"]*"\)\./g, "");
}

/**
 * Build a QuickInfo response for hovering over an operator token
 * that corresponds to an overloaded operator. Extracts the function
 * signature and JSDoc from the overload definition.
 */
export function getOverloadHoverInfo(
	ts: typeof tsRuntime,
	project: TsMorphProject,
	edit: OverloadEditInfo,
): tsRuntime.QuickInfo | undefined {
	try {
		// Extract JSDoc from the method declaration (or its first overload signature).
		let docText: string | undefined;
		const classSourceFile = project.getSourceFile(edit.classFilePath);
		if (classSourceFile) {
			const classDecl = classSourceFile.getClass(edit.className);
			if (classDecl) {
				const method = classDecl
					.getMethods()
					.find((m) => getOperatorStringFromMethod(m) === edit.operatorString);
				if (method) {
					const overloads = method.getOverloads();
					const source = overloads.length > 0 ? overloads[0] : method;
					const jsDocs = source.getJsDocs();
					if (jsDocs.length > 0) {
						const raw = jsDocs[0].getText();
						docText = raw
							.replace(/^\/\*\*\s*/, "")
							.replace(/\s*\*\/$/, "")
							.replace(/^\s*\* ?/gm, "")
							.trim();
					}
				}
			}
		}

		// Build display signature parts based on overload kind.
		// Types are sourced from the resolved expression types stored at scan time.
		const returnTypeName = simplifyTypeName(edit.returnType);
		const displayParts: tsRuntime.SymbolDisplayPart[] = [];

		if (edit.kind === "prefixUnary") {
			// Prefix unary: "-Vec2 = Vec2"
			displayParts.push({ text: edit.operatorString, kind: "operator" });
			displayParts.push({
				text: simplifyTypeName(edit.operandType ?? edit.className),
				kind: "className",
			});
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({ text: returnTypeName, kind: "className" });
			}
		} else if (edit.kind === "postfixUnary") {
			// Postfix unary: "Vec2++"
			displayParts.push({ text: edit.className, kind: "className" });
			displayParts.push({ text: edit.operatorString, kind: "operator" });
		} else if (edit.isStatic) {
			// Binary static: "LhsType + RhsType = ReturnType"
			displayParts.push({
				text: simplifyTypeName(edit.lhsType ?? edit.className),
				kind: "className",
			});
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({ text: edit.operatorString, kind: "operator" });
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({
				text: simplifyTypeName(edit.rhsType ?? edit.className),
				kind: "className",
			});
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({ text: returnTypeName, kind: "className" });
			}
		} else {
			// Binary instance: "ClassName += RhsType"
			displayParts.push({ text: edit.className, kind: "className" });
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({ text: edit.operatorString, kind: "operator" });
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({
				text: simplifyTypeName(edit.rhsType ?? "unknown"),
				kind: "className",
			});
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({ text: returnTypeName, kind: "className" });
			}
		}

		return {
			kind: ts.ScriptElementKind.functionElement,
			kindModifiers: edit.isStatic ? "static" : "",
			textSpan: {
				start: edit.operatorStart,
				length: edit.operatorEnd - edit.operatorStart,
			},
			displayParts,
			documentation: docText ? [{ text: docText, kind: "text" }] : undefined,
			tags: [],
		};
	} catch {
		return undefined;
	}
}
