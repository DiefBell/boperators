/**
 * Overload symbol for the `+` operator,
 * e.g. `v1 + v2`.
 *
 * Method should return a new value that is,
 * in some way, the "sum" of the two operands.
 *
 * It must be a static method.
 *
 * @example
 * ```ts
 * public static readonly [PLUS] = [
 *    // add two Vec3s
 *   function (a: Vector3, b: Vector3) {
 *     return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
 *   },
 * ];
 */
export const PLUS = Symbol("+");

/**
 * Overload symbol for the `+=` operator,
 * e.g. `v1 += v2`.
 *
 * Note that, although you won't necessarily be reassigning to this variable,
 * it must still be declared with the `let` keyword.
 *
 * Method should modify the value on the left-hand
 * side of the operator in some way.
 *
 * It must be an instance method.
 *
 * @example
 * ```ts
 * public readonly [PLUS_EQUALS] = [
 *   // add another Vec3 to this
 *  function (this: Vector3, b: Vector3): void {
 *    this.x += b.x;
 *    this.y += b.y;
 *    this.z += b.z;
 *  },
 * ];
 */
export const PLUS_EQUALS = Symbol("+=");

export const MINUS = Symbol("-");
export const MINUS_EQUALS = Symbol("-=");

export const MULTIPLY = Symbol("*");
export const MULTIPLY_EQUALS = Symbol("*=");

export const DIVIDE = Symbol("/");
export const DIVIDE_EQUALS = Symbol("/=");

export const GREATER_THAN = Symbol(">");
export const GREATER_THAN_EQUAL_TO = Symbol(">=");

export const LESS_THAN = Symbol("<");
export const LESS_THAN_EQUAL_TO = Symbol("<=");

export const MODULO = Symbol("%");
export const MODULO_EQUALS = Symbol("%=");

export const EQUALS = Symbol("==");
export const STRICT_EQUALS = Symbol("===");

export const NOT_EQUALS = Symbol("!=");
export const STRICT_NOT_EQUALS = Symbol("!==");

export const AND = Symbol("&&");
export const AND_EQUALS = Symbol("&&=");

export const OR = Symbol("||");
export const OR_EQUALS = Symbol("||=");

export const NULLISH = Symbol("??");
