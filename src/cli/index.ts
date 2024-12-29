import * as path from "path";
import { Project as TsMorphProject } from "ts-morph";
import { OverloadStore } from "./OverloadStore";

const testFilePath = path.join(process.cwd(), "test", "test.ts");

// Initialise the ts-morph project
const project = new TsMorphProject();
project.addSourceFilesAtPaths([testFilePath]);
const overloadStore = new OverloadStore(project);
console.log(overloadStore.toString());

// A set of operator symbols for quick checks

// Load test file
const testFile = project.getSourceFileOrThrow(testFilePath);
