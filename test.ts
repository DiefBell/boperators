// import { ADD } from "./operators";

// const ADD = Symbol();

class Vector3 {
	ADD = [
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

const v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(7, 10, 13);

const v3: Vector3 = v1 + v2;

console.log(v3);
