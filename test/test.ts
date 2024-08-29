import { ADD } from "../src/lib/index";
import * as ops from "../src/lib/index";

export class Vector3
{
	public readonly [ops.MULTIPLY] = {
		// @boperators/Commutative
		"Multiply by a scalar": (rhs: number) =>
			new Vector3(this.x * rhs, this.y * rhs, this.y * rhs),
	};

	public readonly [ADD] = {
		// print a warning, we don't need "commutative" if its the same type
		// @boperators/Commutative
		"Add another Vec3": function addAnotherVec3(rhs: Vector3)
		{
			return new Vector3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
		},
		// @boperators/Commutative
		"Add a number": function (rhs: number)
		{
			return new Vector3(this.x + rhs, this.y + rhs, this.z + rhs);
		},
	};

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
