import { PLUS as ADD, PLUS_EQUALS } from "../src/lib/index";
import * as ops from "../src/lib/index";

export class Vector3
{
	public static readonly [ops.MULTIPLY] = [
		(lhs: Vector3, rhs: number) =>
			new Vector3(lhs.x * rhs, lhs.y * rhs, lhs.y * rhs),
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
		function addAnotherVec3(rhs: Vector3)
		{
			this.x += rhs.x;
			this.y += rhs.y;
			this.z += rhs.z;
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
}

const v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(7, 10, 13);

const v3: Vector3 = v1 + v2;

console.log(v3);
