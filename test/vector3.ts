import { PLUS as ADD, PLUS_EQUALS } from "../src/lib/index";
import fs from "fs";ops from "../src/lib/index";

export class Vector3
{
	public static readonly [ops.MULTIPLY] = [
		function (lhs: Vector3, rhs: number)
		{
			return new Vector3(lhs.x * rhs, lhs.y * rhs, lhs.y * rhs);
		},
	];

	public static readonly [ADD] = [
		function addAnotherVec3(lhs: Vector3, rhs: Vector3)
		{
			return new Vector3(lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z);
		},
		function (lhs: Vector3, rhs: number)
		{
			return new Vector3(lhs.x + rhs, lhs.y + rhs, lhs.z + rhs);
		},
	];

	public readonly [PLUS_EQUALS] = [
		function addAnotherVec3(this: Vector3, rhs: Vector3)
		{
			this.x += rhs.x;
			this.y += rhs.y;
			this.z += rhs.z;
		},
	];

	public static readonly [ops.GREATER_THAN_EQUAL_TO] = [
		function (lhs: Vector3, rhs: Vector3)
		{
			return lhs.magnitude() >= rhs.magnitude();
		},
	];

	x: number;
	y: number;
	z: number;

	constructor(x: number, y: number, z: number)
	{
		this.x = x;
		this.y = y;
		this.z = z;
	}

	public magnitude()
	{
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}
}
