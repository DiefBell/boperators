import { Vec2 } from "./Vec2";

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;
const d = a * b; // Vec2 * Vec2 — component-wise
const e = a * 2; // Vec2 * number — scalar

console.log(c.toString()); // Vec2(4, 6)
console.log(d.toString()); // Vec2(3, 8)
console.log(e.toString()); // Vec2(2, 4)

// Also render the results to the page
const p = document.createElement("p");
p.textContent = c.toString();
document.body.appendChild(p);

const p2 = document.createElement("p");
p2.textContent = `${d.toString()}, ${e.toString()}`;
document.body.appendChild(p2);
