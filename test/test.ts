import { Vector3 } from "./vector3";

const v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(7, 10, 13);

let v3: Vector3 = v1 + v2;
console.log(v3);

v3 += v1;
console.log(v3);

console.log(v1 * 5);
