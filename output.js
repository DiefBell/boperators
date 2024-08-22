// import { ADD } from "./operators";
// const ADD = Symbol();
class MyVector3 {
    static ADD = [
        [MyVector3, MyVector3, (a, b) => {
                return new MyVector3(a.x + b.x, a.y + b.y, a.z + b.z);
            }],
        [MyVector3, "number", (a, b) => 5]
    ];
    x;
    y;
    z;
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
const v1 = new MyVector3(1, 2, 3);
const v2 = new MyVector3(7, 10, 13);
const v3 = MyVector3.ADD[0][2](v1, v2);
console.log(v3);
