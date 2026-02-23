import { type MethodDeclaration, SyntaxKind } from "ts-morph";

/**
 * Extracts the operator string from a class method declaration, if it
 * represents an operator overload.
 *
 * Handles three method name styles:
 * - `["+"]` — ComputedPropertyName with a StringLiteral expression
 * - `[Operator.PLUS]` — ComputedPropertyName with an enum member expression
 * - `"+"` — StringLiteral method name
 *
 * Returns `undefined` if the method name doesn't resolve to an operator string.
 */
export function getOperatorStringFromMethod(
	method: MethodDeclaration,
): string | undefined {
	const nameNode = method.getNameNode();

	if (nameNode.isKind(SyntaxKind.ComputedPropertyName)) {
		const expression = nameNode.getExpression();
		if (expression.isKind(SyntaxKind.StringLiteral)) {
			return expression.getLiteralValue();
		}
		// Handle Operator.PLUS style (enum member access)
		const literalValue = expression.getType().getLiteralValue();
		if (typeof literalValue === "string") {
			return literalValue;
		}
	} else if (nameNode.isKind(SyntaxKind.StringLiteral)) {
		return nameNode.getLiteralValue();
	}

	return undefined;
}
