import { type PropertyDeclaration, SyntaxKind } from "ts-morph";

/**
 * Extracts the operator string from a class property declaration, if it
 * represents an operator overload.
 *
 * Handles three property name styles:
 * - `["+"]` — ComputedPropertyName with a StringLiteral expression
 * - `[Operator.PLUS]` — ComputedPropertyName with an enum member expression
 * - `"+"` — StringLiteral property name
 *
 * Returns `undefined` if the property name doesn't resolve to an operator string.
 */
export function getOperatorStringFromProperty(
	property: PropertyDeclaration,
): string | undefined {
	const nameNode = property.getNameNode();

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
