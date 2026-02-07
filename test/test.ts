import fs from "fs";V3 from "./vector3";

const v1 = new V3.Vector3(1, 2, 3);
console.log(v1);
const v2 = new V3.Vector3(7, 10, 13);
console.log(v2);

let v3: V3.Vector3 = v1 + v2;
console.log(v3);

v3 += v1;
console.log(v3);

console.log(v1 * 5);
