import { type Expression, Node } from "ts-morph";

/**
 * Unwraps `as const` and `satisfies` type assertions from an initializer
 * expression, returning the underlying expression.
 *
 * For example, given `[fn1, fn2] as const`, this returns the
 * `[fn1, fn2]` ArrayLiteralExpression.
 */
export function unwrapInitializer(
	initializer: Expression | undefined,
): Expression | undefined {
	if (initializer && Node.isAsExpression(initializer))
		initializer = initializer.getExpression();
	if (initializer && Node.isSatisfiesExpression(initializer))
		initializer = initializer.getExpression();
	return initializer;
}
