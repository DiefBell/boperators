import { type Node, SyntaxKind } from "ts-morph";

/**
 * Strips `import("...").` qualification from a type name as returned by
 * ts-morph's `getType().getText()`. Language-server and cross-package contexts
 * produce fully-qualified names like `import("/path/to/file").ClassName`, but
 * overloads are keyed by short class names.
 */
export function normalizeTypeName(typeName: string): string {
	return typeName.replace(/import\("[^"]*"\)\./g, "");
}

/**
 * Resolves the effective type name for a node in a binary expression.
 *
 * Handles special cases:
 * - Numeric literals → `"number"`
 * - Boolean literals (not in string context) → `"boolean"`
 * - `"any"` type → falls back to the declared type of the symbol
 *   (needed for compound assignments where TS can't infer the result type)
 * - Qualified type names → stripped to short class name via `normalizeTypeName`
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

	return normalizeTypeName(typeName);
}
