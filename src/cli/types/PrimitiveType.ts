/**
 * List of primitive types, except for `"undefined"` and `"null"`.
 */
export const primitiveTypes = ["number", "string", "boolean"] as const;

/**
 * Union type of all primitive types, except for `"undefined"` and `"null"`.
 */
export type PrimitiveType = typeof primitiveTypes[number];

/**
 * Typeguard to check if a string is of a primitive type.
 * @param str The string to check.
 * @returns `true` if `str` is of a primitive type, `false` otherwise.
 */
export const isPrimitive = (str: string): str is PrimitiveType =>
	primitiveTypes.includes(str as PrimitiveType);
