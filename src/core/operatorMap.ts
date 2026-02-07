import { SyntaxKind } from "ts-morph";

/**
 * Maps operator names to their corresponding TypeScript syntax kind.
 */
export const operatorMap = {
	PLUS: SyntaxKind.PlusToken,
	PLUS_EQUALS: SyntaxKind.PlusEqualsToken,
	MINUS: SyntaxKind.MinusToken,
	MINUS_EQUALS: SyntaxKind.MinusEqualsToken,
	MULTIPLY: SyntaxKind.AsteriskToken,
	MULTIPLY_EQUALS: SyntaxKind.AsteriskEqualsToken,
	DIVIDE: SyntaxKind.SlashToken,
	DIVIDE_EQUALS: SyntaxKind.SlashEqualsToken,
	GREATER_THAN: SyntaxKind.GreaterThanToken,
	GREATER_THAN_EQUAL_TO: SyntaxKind.GreaterThanEqualsToken,
	LESS_THAN: SyntaxKind.LessThanToken,
	LESS_THAN_EQUAL_TO: SyntaxKind.LessThanEqualsToken,
	MODULO: SyntaxKind.PercentToken,
	MODULO_EQUALS: SyntaxKind.PercentEqualsToken,
	EQUALS: SyntaxKind.EqualsEqualsToken,
	STRICT_EQUALS: SyntaxKind.EqualsEqualsEqualsToken,
	NOT_EQUALS: SyntaxKind.ExclamationEqualsToken,
	STRICT_NOT_EQUALS: SyntaxKind.ExclamationEqualsEqualsToken,
	AND: SyntaxKind.AmpersandAmpersandToken,
	AND_EQUALS: SyntaxKind.AmpersandAmpersandEqualsToken,
	OR: SyntaxKind.BarBarToken,
	OR_EQUALS: SyntaxKind.BarBarEqualsToken,
	NULLISH: SyntaxKind.QuestionQuestionToken,
} as const;

export type OperatorName = keyof typeof operatorMap;
export const operatorSyntaxKinds = Object.values(operatorMap);
export type OperatorSyntaxKind = typeof operatorMap[OperatorName];

export const isOperatorSyntaxKind = (syntaxKind: SyntaxKind): syntaxKind is OperatorSyntaxKind =>
	operatorSyntaxKinds.includes(syntaxKind as OperatorSyntaxKind);

/**
 * Set of which operators whose overloads should be instance operators
 * i.e. operate on the LHS object.
 * These should return void.
 */
export const instanceOperators = new Set<OperatorSyntaxKind>([
	operatorMap.PLUS_EQUALS,
	operatorMap.MINUS_EQUALS,
	operatorMap.MULTIPLY_EQUALS,
	operatorMap.DIVIDE_EQUALS,
	operatorMap.MODULO_EQUALS,
	operatorMap.AND_EQUALS,
	operatorMap.OR_EQUALS,
]);

/**
 * Set of operators where the expected return type of their overload is a boolean.
 */
export const comparisonOperators = new Set<OperatorSyntaxKind>([
	operatorMap.GREATER_THAN,
	operatorMap.GREATER_THAN_EQUAL_TO,
	operatorMap.LESS_THAN,
	operatorMap.LESS_THAN_EQUAL_TO,
	operatorMap.EQUALS,
	operatorMap.STRICT_EQUALS,
	operatorMap.NOT_EQUALS,
	operatorMap.STRICT_NOT_EQUALS,
]);
