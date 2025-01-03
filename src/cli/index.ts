/* eslint-disable @stylistic/no-multiple-empty-lines */
import { Command } from "@commander-js/extra-typings";
import { Project as TsMorphProject } from "ts-morph";
import { OverloadStore } from "../core/OverloadStore";
import { ErrorManager } from "../core/ErrorManager";
import { OverloadInjector } from "../core/OverloadInjector";
import * as path from "path";
import * as fs from "fs";
import { version } from "../../package.json";


const program = new Command()
	.name("boperate")
	.description("Parse operator overloads and inject them into TS files.")
	.version(version)

	.option(
		"-t, --ts-out",
		"Output directory for TypeScript files once overloads have been injected. "
		+ "If not specified, intermediate TS files will not be emitted"
	)
	.option(
		"-p, --project <path>",
		"Path to tsconfig.json to use for transpilation if transpiling to JavaScript.",
		"tsconfig.json"
	)
	.option(
		"-d, --dryRun",
		"If specified, no JavaScript will be emited to file. All standard logging will shown however. "
		+ "If --ts-out is specified then TypeScript will be emitted.",
		false
	);

program.parse(process.argv);
const options = program.opts();

const tsConfigFilePath = path.isAbsolute(options.project) ? options.project : path.join(process.cwd(), options.project);
if (!fs.existsSync(tsConfigFilePath))
{
	throw new Error(`Unable to find tsconfig file at "${tsConfigFilePath}".`);
}

const project = new TsMorphProject({ tsConfigFilePath });
const errorManager = new ErrorManager(
	process.argv.includes("--error-on-warning")
);
const overloadStore = new OverloadStore(project, errorManager);
const overloadInjector = new OverloadInjector(project, overloadStore);

const files = project.getSourceFiles();

files.forEach((file) => overloadStore.addOverloadsFromFile(file));
errorManager.throwIfErrorsElseLogWarnings();

files.forEach((file) => overloadInjector.overloadFile(file));
errorManager.throwIfErrorsElseLogWarnings();


// if (options.dryRun)
// {
// 	process.exit(0);
// }

// if (!options.tsOut)
// {
// 	const tmpDir = path.isAbsolute(options.tmpDir) ? options.tmpDir : path.join(process.cwd(), options.tmpDir);
// 	if (!fs.existsSync(tmpDir))
// 	{
// 		fs.mkdirSync(tmpDir, { recursive: true });
// 	}
// }
