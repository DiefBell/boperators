import { Vec2 } from "./Vec2";

const a = new Vec2(1, 2);
const b = new Vec2(3, 4);
const c = a + b;

console.log(c.toString()); // Vec2(4, 6)
