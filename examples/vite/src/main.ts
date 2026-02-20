import { Vec2 } from "./Vec2";

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;

// Displays "Vec2(4, 6)" in the browser console
console.log(c.toString());

// Also render the result to the page so the e2e test can verify it
const p = document.createElement("p");
p.textContent = c.toString();
document.body.appendChild(p);
