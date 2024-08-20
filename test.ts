import { ADD } from "./operators";

class Vector3 {
	[ADD] = [
		[Vector3, Vector3, (a: Vector3, b: Vector3) => {
			return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
		}],
		[Vector3, "number", (a: Vector3, b: number) => 5]
	]

	x: number;
	y: number;
	z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
}

export {
	Vector3,
	Vector3 as Vec3
}
