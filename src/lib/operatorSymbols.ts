/**
 * Enum of all supported operator overloads.
 *
 * Use the operator string directly as a computed property name
 * in your class to define an overload:
 *
 * @example
 * ```ts
 * class Vector3 {
 *   static readonly ["+"] = [
 *     function (a: Vector3, b: Vector3) {
 *       return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
 *     },
 *   ];
 * }
 * ```
 */
export enum Operator
{
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
}

export const operatorSymbols: string[] = Object.values(Operator);
