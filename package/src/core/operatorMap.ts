import { SyntaxKind } from "ts-morph";
import { Operator } from "../lib/operatorSymbols";

/**
 * Maps operator string values to their corresponding TypeScript syntax kind.
 */
export const operatorMap = {
	[Operator.PLUS]: SyntaxKind.PlusToken,
	[Operator.PLUS_EQUALS]: SyntaxKind.PlusEqualsToken,
	[Operator.MINUS]: SyntaxKind.MinusToken,
	[Operator.MINUS_EQUALS]: SyntaxKind.MinusEqualsToken,
	[Operator.MULTIPLY]: SyntaxKind.AsteriskToken,
	[Operator.MULTIPLY_EQUALS]: SyntaxKind.AsteriskEqualsToken,
	[Operator.EXPONENT]: SyntaxKind.AsteriskAsteriskToken,
	[Operator.EXPONENT_EQUALS]: SyntaxKind.AsteriskAsteriskEqualsToken,
	[Operator.DIVIDE]: SyntaxKind.SlashToken,
	[Operator.DIVIDE_EQUALS]: SyntaxKind.SlashEqualsToken,
	[Operator.GREATER_THAN]: SyntaxKind.GreaterThanToken,
	[Operator.GREATER_THAN_EQUAL_TO]: SyntaxKind.GreaterThanEqualsToken,
	[Operator.LESS_THAN]: SyntaxKind.LessThanToken,
	[Operator.LESS_THAN_EQUAL_TO]: SyntaxKind.LessThanEqualsToken,
	[Operator.MODULO]: SyntaxKind.PercentToken,
	[Operator.MODULO_EQUALS]: SyntaxKind.PercentEqualsToken,
	[Operator.EQUALS]: SyntaxKind.EqualsEqualsToken,
	[Operator.STRICT_EQUALS]: SyntaxKind.EqualsEqualsEqualsToken,
	[Operator.NOT_EQUALS]: SyntaxKind.ExclamationEqualsToken,
	[Operator.STRICT_NOT_EQUALS]: SyntaxKind.ExclamationEqualsEqualsToken,
	[Operator.AND]: SyntaxKind.AmpersandAmpersandToken,
	[Operator.AND_EQUALS]: SyntaxKind.AmpersandAmpersandEqualsToken,
	[Operator.OR]: SyntaxKind.BarBarToken,
	[Operator.OR_EQUALS]: SyntaxKind.BarBarEqualsToken,
	[Operator.NULLISH]: SyntaxKind.QuestionQuestionToken,
} as const;

export type OperatorString = keyof typeof operatorMap;
export const operatorSyntaxKinds = Object.values(operatorMap);
export type OperatorSyntaxKind = (typeof operatorMap)[OperatorString];

export const isOperatorSyntaxKind = (
	syntaxKind: SyntaxKind,
): syntaxKind is OperatorSyntaxKind =>
	operatorSyntaxKinds.includes(syntaxKind as OperatorSyntaxKind);

/**
 * Set of which operators whose overloads should be instance operators
 * i.e. operate on the LHS object.
 * These should return void.
 */
export const instanceOperators = new Set<OperatorSyntaxKind>([
	operatorMap[Operator.PLUS_EQUALS],
	operatorMap[Operator.MINUS_EQUALS],
	operatorMap[Operator.MULTIPLY_EQUALS],
	operatorMap[Operator.EXPONENT_EQUALS],
	operatorMap[Operator.DIVIDE_EQUALS],
	operatorMap[Operator.MODULO_EQUALS],
	operatorMap[Operator.AND_EQUALS],
	operatorMap[Operator.OR_EQUALS],
]);

/**
 * Set of operators where the expected return type of their overload is a boolean.
 */
export const comparisonOperators = new Set<OperatorSyntaxKind>([
	operatorMap[Operator.GREATER_THAN],
	operatorMap[Operator.GREATER_THAN_EQUAL_TO],
	operatorMap[Operator.LESS_THAN],
	operatorMap[Operator.LESS_THAN_EQUAL_TO],
	operatorMap[Operator.EQUALS],
	operatorMap[Operator.STRICT_EQUALS],
	operatorMap[Operator.NOT_EQUALS],
	operatorMap[Operator.STRICT_NOT_EQUALS],
]);

/**
 * Maps prefix unary operator strings to their corresponding TypeScript syntax kind.
 * Operators like `-` and `+` share SyntaxKind tokens with their binary counterparts;
 * disambiguation happens at the AST node level (PrefixUnaryExpression vs BinaryExpression).
 */
export const prefixUnaryOperatorMap = {
	[Operator.MINUS]: SyntaxKind.MinusToken,
	[Operator.PLUS]: SyntaxKind.PlusToken,
	[Operator.NOT]: SyntaxKind.ExclamationToken,
	[Operator.BITWISE_NOT]: SyntaxKind.TildeToken,
} as const;

export type PrefixUnaryOperatorString = keyof typeof prefixUnaryOperatorMap;
export const prefixUnaryOperatorSyntaxKinds = Object.values(
	prefixUnaryOperatorMap,
);
export type PrefixUnaryOperatorSyntaxKind =
	(typeof prefixUnaryOperatorMap)[PrefixUnaryOperatorString];

export const isPrefixUnaryOperatorSyntaxKind = (
	syntaxKind: SyntaxKind,
): syntaxKind is PrefixUnaryOperatorSyntaxKind =>
	prefixUnaryOperatorSyntaxKinds.includes(
		syntaxKind as PrefixUnaryOperatorSyntaxKind,
	);

/**
 * Maps postfix unary operator strings to their corresponding TypeScript syntax kind.
 */
export const postfixUnaryOperatorMap = {
	[Operator.INCREMENT]: SyntaxKind.PlusPlusToken,
	[Operator.DECREMENT]: SyntaxKind.MinusMinusToken,
} as const;

export type PostfixUnaryOperatorString = keyof typeof postfixUnaryOperatorMap;
export const postfixUnaryOperatorSyntaxKinds = Object.values(
	postfixUnaryOperatorMap,
);
export type PostfixUnaryOperatorSyntaxKind =
	(typeof postfixUnaryOperatorMap)[PostfixUnaryOperatorString];

export const isPostfixUnaryOperatorSyntaxKind = (
	syntaxKind: SyntaxKind,
): syntaxKind is PostfixUnaryOperatorSyntaxKind =>
	postfixUnaryOperatorSyntaxKinds.includes(
		syntaxKind as PostfixUnaryOperatorSyntaxKind,
	);

/**
 * Set of operator strings that can appear as prefix unary overloads.
 */
export const prefixUnaryOperatorStrings = new Set<string>(
	Object.keys(prefixUnaryOperatorMap),
);

/**
 * Set of operator strings that can appear as postfix unary overloads.
 */
export const postfixUnaryOperatorStrings = new Set<string>(
	Object.keys(postfixUnaryOperatorMap),
);
