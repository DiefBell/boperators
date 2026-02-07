import { AND, AND_EQUALS, DIVIDE, DIVIDE_EQUALS, EQUALS, GREATER_THAN, GREATER_THAN_EQUAL_TO, LESS_THAN, LESS_THAN_EQUAL_TO, MULTIPLY, MULTIPLY_EQUALS, NOT_EQUALS, OR, OR_EQUALS, PLUS, PLUS_EQUALS, STRICT_EQUALS, STRICT_NOT_EQUALS } from "boperators";

export class Vector3
{
	public x: number;
	public y: number;
	public z: number;

	constructor(x: number, y: number, z: number)
	{
		this.x = x;
		this.y = y;
		this.z = z;
	}

	public static readonly [PLUS] = [
		/**
		 * Add two Vec3s.
		 */
		function (a: Vector3, b: Vector3)
		{
			return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
		},
	];

	public readonly [PLUS_EQUALS] = [
		/**
		 * Add another Vec3 to this.
		 */
		function (this: Vector3, b: Vector3): void
		{
			this.x += b.x;
			this.y += b.y;
			this.z += b.z;
		},
	];

	public static readonly [MULTIPLY] = [
		/**
		 * The cross-product of two Vec3s.
		 */
		function (a: Vector3, b: Vector3): Vector3
		{
			return new Vector3(
				a.y * b.z - a.z * b.y,
				a.z * b.x - a.x * b.z,
				a.x * b.y - a.y * b.x
			);
		},
		/**
		 * Multiply a Vec3 by a scalar.
		 */
		function (a: Vector3, b: number): Vector3
		{
			return new Vector3(a.x * b, a.y * b, a.z * b);
		},
	] as const;

	public readonly [MULTIPLY_EQUALS] = [
		/**
		 * Multiply this Vec3 by a scalar.
		 */
		function (this: Vector3, a: number): void
		{
			this.x *= a;
			this.y *= a;
			this.z *= a;
		},
	];

	public static readonly [DIVIDE] = [
		/**
		 * Divide by a scalar.
		 */
		function (a: Vector3, b: number): Vector3
		{
			return new Vector3(a.x / b, a.y / b, a.z / b);
		},
	];

	public readonly [DIVIDE_EQUALS] = [
		/**
		 * Divide this Vec3 by a scalar.
		 */
		function (this: Vector3, a: number): void
		{
			this.x /= a;
			this.y /= a;
			this.z /= a;
		},
	];

	public static readonly [GREATER_THAN] = [
		/**
		 * lhs magnitude is greater than rhs magnitude
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() > b.length();
		},
	];

	public static readonly [GREATER_THAN_EQUAL_TO] = [
		/**
		 * lhs magnitude is greater than or equal to rhs magnitude
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() >= b.length();
		},
	];

	public static readonly [LESS_THAN] = [
		/**
		 * lhs magnitude is less than rhs magnitude
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() < b.length();
		},
	];

	public static readonly [LESS_THAN_EQUAL_TO] = [
		/**
		 * lhs magnitude is less than or equal to rhs magnitude
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() <= b.length();
		},
	];

	public static readonly [EQUALS] = [
		/**
		 * vectors' lengths are equal
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() === b.length();
		},
	];

	public static readonly [STRICT_EQUALS] = [
		/**
		 * vectors' components are equal
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.x === b.x && a.y === b.y && a.z === b.z;
		},
	];

	public static readonly [NOT_EQUALS] = [
		/**
		 * vectors' lengths are not equal
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() !== b.length();
		},
	];

	public static readonly [STRICT_NOT_EQUALS] = [
		/**
		 * vectors' components are not equal
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.x !== b.x || a.y !== b.y || a.z !== b.z;
		},
	];

	public static readonly [AND] = [
		/**
		 * both vectors' magnitudes are greater than 0
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() > 0 && b.length() > 0;
		},
	];

	public readonly [AND_EQUALS] = [
		/**
		 * if both magnitudes are greater than zero, replace this with b
		 */
		function (this: Vector3, b: Vector3): void
		{
			if (this.length() > 0 && b.length() > 0)
			{
				this.x = b.x;
				this.y = b.y;
				this.z = b.z;
			}
		},
	];

	public static readonly [OR] = [
		/**
		 * either vector's magnitude is greater than 0
		 */
		function (a: Vector3, b: Vector3): boolean
		{
			return a.length() > 0 || b.length() > 0;
		},
	];

	public readonly [OR_EQUALS] = [
		/**
		 * if this has zero magnitude, replace this with b
		 */
		function (this: Vector3, b: Vector3): void
		{
			if (this.length() === 0)
			{
				this.x = b.x;
				this.y = b.y;
				this.z = b.z;
			}
		},
	];

	public static dot(a: Vector3, b: Vector3): number
	{
		return a.x * b.x + a.y * b.y + a.z * b.z;
	}

	public static cross(a: Vector3, b: Vector3): Vector3
	{
		return Vector3[MULTIPLY][0](a, b);
	}

	public length(): number
	{
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	public magnitude(): number
	{
		return this.length();
	}

	public normalize(): Vector3
	{
		const len = this.length();
		return new Vector3(this.x / len, this.y / len, this.z / len);
	}

	public toString(): string
	{
		return `Vector3(${this.x}, ${this.y}, ${this.z})`;
	}
}
