import { ADD } from "../src/lib/index";

export class MyVector3 {
	public static readonly ADD = [
		[MyVector3, MyVector3, (a: MyVector3, b: MyVector3) => {
			return new MyVector3(a.x + b.x, a.y + b.y, a.z + b.z);
		}],
		[MyVector3, "number", (a: MyVector3, b: number) => 5]
	] as const;

	x: number;
	y: number;
	z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
}

const v1 = new MyVector3(1, 2, 3);
const v2 = new MyVector3(7, 10, 13);

const v3: MyVector3 = v1 + v2;

console.log(v3);
