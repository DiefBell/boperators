/**
 * Designed for internal use to ensure consistency.
 */
export enum Operator {
	PLUS = "+",
	PLUS_EQUALS = "+=",
	MINUS = "-",
	MINUS_EQUALS = "-=",
	MULTIPLY = "*",
	MULTIPLY_EQUALS = "*=",
	DIVIDE = "/",
	DIVIDE_EQUALS = "/=",
	GREATER_THAN = ">",
	GREATER_THAN_EQUAL_TO = ">=",
	LESS_THAN = "<",
	LESS_THAN_EQUAL_TO = "<=",
	MODULO = "%",
	MODULO_EQUALS = "%=",
	EQUALS = "==",
	STRICT_EQUALS = "===",
	NOT_EQUALS = "!=",
	STRICT_NOT_EQUALS = "!==",
	AND = "&&",
	AND_EQUALS = "&&=",
	OR = "||",
	OR_EQUALS = "||=",
	NULLISH = "??",
	NOT = "!",
	BITWISE_NOT = "~",
	INCREMENT = "++",
	DECREMENT = "--",
}

export const operatorSymbols: string[] = Object.values(Operator);
