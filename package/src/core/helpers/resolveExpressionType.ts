import { type Node, SyntaxKind } from "ts-morph";

/**
 * Strips `import("...").` qualification and generic type parameters from a
 * type name as returned by ts-morph's `getType().getText()`.
 *
 * Language-server and cross-package contexts produce fully-qualified names like
 * `import("/path/to/file").ClassName`, and generic classes produce names like
 * `ClassName<T>`. Overloads are keyed by bare class names, so both forms must
 * be stripped.
 *
 * Note: generic stripping cuts at the first `<`, so union/intersection types
 * that themselves contain generic members (e.g. `Foo<T> | Bar`) are reduced to
 * the first segment only. Operator overload parameter types are always single
 * type names, so this does not arise in practice.
 */
export function normalizeTypeName(typeName: string): string {
	const withoutImport = typeName.replace(/import\("[^"]*"\)\./g, "");
	const genericIdx = withoutImport.indexOf("<");
	return genericIdx === -1 ? withoutImport : withoutImport.slice(0, genericIdx);
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
