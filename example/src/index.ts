import { Matrix } from "./Matrix";

const m1 = new Matrix(3, 3, [
	[1, 0, 0],
	[0, 1, 0],
	[0, 0, 1],
]);


const m2 = new Matrix(3, 3, [
	[1, 2, 3],
	[6, 5, 4],
	[7, 8, 9],
]);

const m3 = m1 + m2;
console.log(m3);
