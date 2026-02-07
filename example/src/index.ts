import { Vector3 } from "./Vector3";

const v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(4, 5, 6);

// Can't infer types in editor, even with language server plugin
const v3: Vector3 = v1 + v2;
console.log(`${v1} + ${v2} = ${v3}`);
