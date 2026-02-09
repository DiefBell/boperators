import { type Node, SyntaxKind } from "ts-morph";

/**
 * Resolves the effective type name for a node in a binary expression.
 *
 * Handles special cases:
 * - Numeric literals → `"number"`
 * - Boolean literals (not in string context) → `"boolean"`
 * - `"any"` type → falls back to the declared type of the symbol
 *   (needed for compound assignments where TS can't infer the result type)
 */
export function resolveExpressionType(node: Node): string {
	let typeName = node.getType().getText();

	if (node.getKind() === SyntaxKind.NumericLiteral) {
		return "number";
	}

	if (
		node.getKind() !== SyntaxKind.StringLiteral &&
		(typeName === "true" || typeName === "false")
	) {
		return "boolean";
	}

	if (typeName === "any") {
		const decl = node.getSymbol()?.getValueDeclaration();
		if (decl) typeName = decl.getType().getText();
	}

	return typeName;
}
