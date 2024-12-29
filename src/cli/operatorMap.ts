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
	GREATER_THAN_EQUALS: SyntaxKind.GreaterThanEqualsToken,
	LESS_THAN: SyntaxKind.LessThanToken,
	LESS_THAN_EQUALS: SyntaxKind.LessThanEqualsToken,
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
	IN: SyntaxKind.InKeyword,
	INSTANCE_OF: SyntaxKind.InstanceOfKeyword,
	NULLISH: SyntaxKind.QuestionQuestionToken,
} as const;

export type OperatorName = keyof typeof operatorMap;
export const operatorSyntaxKinds = Object.values(operatorMap);
export type OperatorSyntaxKind = typeof operatorMap[OperatorName];

export const isOperatorSyntaxKind = (syntaxKind: SyntaxKind): syntaxKind is OperatorSyntaxKind =>
	operatorSyntaxKinds.includes(syntaxKind as OperatorSyntaxKind);
