import { OperatorOverrideManger } from "./OperatorOverrideManager";
import { doIt } from "./doIt";
import * as path from "path";
import ts from "typescript";

// doIt("test/test.ts");
const testFilePath = path.join(process.cwd(), "test", "test.ts");

const program = ts.createProgram({
    rootNames: [
        path.join(process.cwd(), "src", "lib", "operatorSymbols.ts"),
        testFilePath
    ],
    options: {}
});

const oom = new OperatorOverrideManger(program);

// console.log(1)
const testSourceFile = program.getSourceFile(testFilePath);

// console.log(2)
if(!testSourceFile) {
    throw new Error();
}

// console.log(3)
oom.loadOverloadsFromFile(testSourceFile);
