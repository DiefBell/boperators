import { Command } from "@commander-js/extra-typings";
import { Project as TsMorphProject } from "ts-morph";
import { OverloadStore } from "../core/OverloadStore";
import { ErrorManager } from "../core/ErrorManager";
import { OverloadInjector } from "../core/OverloadInjector";
import path from "path";
import fs from "fs";
import { version } from "../../package.json";

const program = new Command()
	.name("boperate")
	.description("Parse operator overloads and inject them into TS files.")
	.version(version)

	.option(
		"-t, --ts-out <dir>",
		"Output directory for TypeScript files once overloads have been injected."
	)
	.option(
		"-p, --project <path>",
		"Path to tsconfig.json to use.",
		"tsconfig.json"
	)
	.option(
		"-d, --dry-run",
		"Preview only without writing files.",
		false
	)
	.option(
		"--error-on-warning",
		"Instead of showing a warning, error on conflicting overloads.",
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
const errorManager = new ErrorManager(options.errorOnWarning);
const overloadStore = new OverloadStore(project, errorManager);
const overloadInjector = new OverloadInjector(project, overloadStore);

const files = project.getSourceFiles();

files.forEach((file) => overloadStore.addOverloadsFromFile(file));
errorManager.throwIfErrorsElseLogWarnings();

files.forEach((file) => overloadInjector.overloadFile(file));
errorManager.throwIfErrorsElseLogWarnings();

if (options.dryRun)
{
	process.exit(0);
}

if (options.tsOut)
{
	const tsOutDir = path.isAbsolute(options.tsOut) ? options.tsOut : path.join(process.cwd(), options.tsOut);
	if (!fs.existsSync(tsOutDir))
	{
		fs.mkdirSync(tsOutDir, { recursive: true });
	}

	files.forEach((file) =>
	{
		const relativePath = path.relative(
			path.dirname(tsConfigFilePath),
			file.getFilePath()
		);
		const outPath = path.join(tsOutDir, relativePath);
		const outDir = path.dirname(outPath);
		if (!fs.existsSync(outDir))
		{
			fs.mkdirSync(outDir, { recursive: true });
		}
		fs.writeFileSync(outPath, file.getFullText());
	});
}
