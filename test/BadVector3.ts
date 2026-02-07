import { PLUS as ADD, PLUS_EQUALS } from "../src/lib/index";
import fs from "fs";ops from "../src/lib/index";

export class BadVector3
{
	public readonly [ops.MULTIPLY] = [
		function (lhs: BadVector3, rhs: number)
		{
			return new BadVector3(lhs.x * rhs, lhs.y * rhs, lhs.y * rhs);
		},
	];

	public [ops.DIVIDE] = 5;

	public static readonly [ADD] = [
		"NOT A FUNCTION",
		function addAnotherVec3(lhs: number, rhs: number)
		{
			return lhs + rhs;
		},
		function (lhs: BadVector3, rhs: number)
		{
			return new BadVector3(lhs.x + rhs, lhs.y + rhs, lhs.z + rhs);
		},
	];

	public static readonly [PLUS_EQUALS] = [
		function addAnotherVec3(rhs: BadVector3)
		{
			this.x += rhs.x;
			this.y += rhs.y;
			this.z += rhs.z;
			return rhs;
		},
	];

	public static readonly [ops.GREATER_THAN_EQUAL_TO] = [
		function (lhs: BadVector3)
		{
			return lhs.x;
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
