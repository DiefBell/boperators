const ADD = Symbol();

interface IOverloadable {
	// ADD: {
	// 	[key: [infer A, infer B]]: (a: A, b: B) => any;
	// }
}

class Vector3 implements IOverloadable {
	ADD = [
		[Vector3, Vector3, (a: Vector3, b: Vector3) => {
			return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
		}]
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
