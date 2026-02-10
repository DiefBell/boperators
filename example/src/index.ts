import { Counter } from "./Counter";
import { Vector3 } from "./Vector3";

// --- Binary operators ---

let v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(4, 5, 6);

const v3 = v1 + v2;
console.log(`${v1} + ${v2} = ${v3}`);

const v4 = v1 - v2;
console.log(`${v1} - ${v2} = ${v4}`);

v1 += v2;
console.log(`v1 += v2 => v1 = ${v1}`);

v1 -= v2;
console.log(`v1 -= v2 => v1 = ${v1}`);

const v5 = new Vector3(2, 3, 6);
const v6 = new Vector3(3, 2, 6);

console.log(`v5 == v6? ${v5 == v6}`); // true (same magnitude)
console.log(`v5 === v6? ${v5 === v6}`); // false (different components)

// --- Prefix unary operators ---

const v7 = new Vector3(1, -2, 3);
const negated = -v7;
console.log(`-${v7} = ${negated}`);

const zero = new Vector3(0, 0, 0);
console.log(`!${v7} = ${!v7}`); // false (non-zero vector)
console.log(`!${zero} = ${!zero}`); // true (zero vector)

// --- Postfix unary operators ---

let counter = new Counter(10);
console.log(`counter = ${counter}`);

counter++;
console.log(`counter++ => ${counter}`);

counter++;
console.log(`counter++ => ${counter}`);

counter--;
console.log(`counter-- => ${counter}`);

// Counter addition (binary) still works alongside postfix
const c1 = new Counter(5);
const c2 = new Counter(3);
const c3 = c1 + c2;
console.log(`${c1} + ${c2} = ${c3}`);
