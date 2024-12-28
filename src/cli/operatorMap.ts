import { SyntaxKind } from "typescript";
import {
	PLUS,
	PLUS_EQUALS,

	MINUS,
	MINUS_EQUALS,

	MULTIPLY,
	MULTIPLY_EQUALS,

	DIVIDE,
	DIVIDE_EQUALS,

	GREATER_THAN,
	GREATER_THAN_EQUALS,

	LESS_THAN,
	LESS_THAN_EQUALS,

	MODULO,
	MODULO_EQUALS,

	EQUALS,
	NOT_EQUALS,

	STRICT_EQUALS,
	STRICT_NOT_EQUALS,

	AND,
	AND_EQUALS,

	OR,
	OR_EQUALS,

	IN,
	INSTANCE_OF,

	NULLISH,
} from "../lib/operatorSymbols";

export const operatorMap = {
	[PLUS]: SyntaxKind.PlusToken,
	[PLUS_EQUALS]: SyntaxKind.PlusEqualsToken,

	[MINUS]: SyntaxKind.MinusToken,
	[MINUS_EQUALS]: SyntaxKind.MinusEqualsToken,

	[MULTIPLY]: SyntaxKind.AsteriskToken,
	[MULTIPLY_EQUALS]: SyntaxKind.AsteriskEqualsToken,

	[DIVIDE]: SyntaxKind.SlashToken,
	[DIVIDE_EQUALS]: SyntaxKind.SlashEqualsToken,

	[GREATER_THAN]: SyntaxKind.GreaterThanToken,
	[GREATER_THAN_EQUALS]: SyntaxKind.GreaterThanEqualsToken,

	[LESS_THAN]: SyntaxKind.LessThanToken,
	[LESS_THAN_EQUALS]: SyntaxKind.LessThanEqualsToken,

	[MODULO]: SyntaxKind.PercentToken,
	[MODULO_EQUALS]: SyntaxKind.PercentEqualsToken,

	[EQUALS]: SyntaxKind.EqualsEqualsToken,
	[STRICT_EQUALS]: SyntaxKind.EqualsEqualsEqualsToken,

	[NOT_EQUALS]: SyntaxKind.ExclamationEqualsToken,
	[STRICT_NOT_EQUALS]: SyntaxKind.ExclamationEqualsEqualsToken,

	[AND]: SyntaxKind.AmpersandAmpersandToken,
	[AND_EQUALS]: SyntaxKind.AmpersandAmpersandEqualsToken,

	[OR]: SyntaxKind.BarBarToken,
	[OR_EQUALS]: SyntaxKind.BarBarEqualsToken,

	[IN]: SyntaxKind.InKeyword,
	[INSTANCE_OF]: SyntaxKind.InstanceOfKeyword,

	[NULLISH]: SyntaxKind.QuestionQuestionToken,
};
