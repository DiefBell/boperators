import * as path from "path";
import { Project as TsMorphProject } from "ts-morph";
import { OverloadStore } from "../core/OverloadStore";
import { ErrorManager } from "../core/ErrorManager";
import { OverloadInjector } from "../core/OverloadInjector";

const testFilesRoot = path.join(
	import.meta.dir,
	"..", // src
	"..", // .
	"test"
);

const classFile = path.join(testFilesRoot, "Vector3.ts");
const testFile = path.join(testFilesRoot, "test.ts");

const testFiles = [
	classFile,
	testFile,
	// uncomment this to check error logging is working correctly
	// path.join(testFilesRoot, "BadVector3.ts"),
];

const project = new TsMorphProject();
project.addSourceFilesAtPaths(testFiles);

const errorManager = new ErrorManager(
	process.argv.includes("--error-on-warning")
);
const overloadStore = new OverloadStore(project, errorManager);
const overloadInjector = new OverloadInjector(project, overloadStore);

overloadStore.addOverloadsFromFile(classFile);
errorManager.throwIfErrorsElseLogWarnings();

overloadInjector.overloadFile(testFile);

// Print the modified content to the console
console.log(project.getSourceFileOrThrow(testFile).getFullText());
