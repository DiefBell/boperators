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
		// add two Vec3s
		(a: Vector3, b: Vector3) =>
		{
			return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
		},
	];

	public readonly [PLUS_EQUALS] = [
		// add another Vec3 to this
		(b: Vector3): void =>
		{
			this.x += b.x;
			this.y += b.y;
			this.z += b.z;
		},
	];

	public static readonly [MULTIPLY] = [
		// The cross-product of two Vec3s
		(a: Vector3, b: Vector3): Vector3 =>
		{
			return new Vector3(
				a.y * b.z - a.z * b.y,
				a.z * b.x - a.x * b.z,
				a.x * b.y - a.y * b.x
			);
		},
		// Multiply a Vec3 by a scalar
		(a: Vector3, b: number): Vector3 =>
		{
			return new Vector3(a.x * b, a.y * b, a.z * b);
		},
	] as const;

	public readonly [MULTIPLY_EQUALS] = [
		// Multiply this Vec3 by a scalar
		(a: number): void =>
		{
			this.x *= a;
			this.y *= a;
			this.z *= a;
		},
	];

	public static readonly [DIVIDE] = [
		// Divide by a scalar
		(a: Vector3, b: number): Vector3 =>
		{
			return new Vector3(a.x / b, a.y / b, a.z / b);
		},
	];

	public readonly [DIVIDE_EQUALS] = [
		// Divide this Vec3 by a scalar
		(a: number): void =>
		{
			this.x /= a;
			this.y /= a;
			this.z /= a;
		},
	];

	public static readonly [GREATER_THAN] = [
		// lhs magnitude is greater than rhs magnitude
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() > b.length();
		},
	];

	public static readonly [GREATER_THAN_EQUAL_TO] = [
		// lhs magnitude is greater than or equal to rhs magnitude
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() >= b.length();
		},
	];

	public static readonly [LESS_THAN] = [
		// lhs magnitude is less than rhs magnitude
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() < b.length();
		},
	];

	public static readonly [LESS_THAN_EQUAL_TO] = [
		// lhs magnitude is less than or equal to rhs magnitude
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() <= b.length();
		},
	];

	public static readonly [EQUALS] = [
		// vectors' lenghs are equal
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() === b.length();
		},
	];

	public static readonly [STRICT_EQUALS] = [
		// vectors' components are equal
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.x === b.x && a.y === b.y && a.z === b.z;
		},
	];

	public static readonly [NOT_EQUALS] = [
		// vectors' lengths are not equal
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() !== b.length();
		},
	];

	public static readonly [STRICT_NOT_EQUALS] = [
		// vectors' components are not equal
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.x !== b.x || a.y !== b.y || a.z !== b.z;
		},
	];

	public static readonly [AND] = [
		// both vectors' magnitudes are greater than 0
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() > 0 && b.length() > 0;
		},
	];

	public static readonly [AND_EQUALS] = [
		// return b if magnitudes are both greater than zero, else return a
		(a: Vector3, b: Vector3): Vector3 =>
		{
			return Vector3[AND][0] ? b : a;
		},
	];

	public static readonly [OR] = [
		// either vector's magnitude is greater than 0
		(a: Vector3, b: Vector3): boolean =>
		{
			return a.length() > 0 || b.length() > 0;
		},
	];

	public static readonly [OR_EQUALS] = [
		// return b if either magnitude is greater than zero, else return a
		(a: Vector3, b: Vector3): Vector3 =>
		{
			return Vector3[OR][0] ? b : a;
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
		return `(${this.x}, ${this.y}, ${this.z})`;
	}
}
