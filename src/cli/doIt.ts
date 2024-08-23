import ts from 'typescript';
import * as path from "path";
import { transformSourceFile } from './transformFile';

export const doIt = (filePath: string) =>
{
	const fileName = path.basename(filePath);
	const sourceFile = ts.createSourceFile(
		fileName,
		ts.sys.readFile(filePath) ?? "",
		ts.ScriptTarget.Latest,
		true
	);

	using transformedSourceFileInfo = transformSourceFile(sourceFile, true)


	// Emit the transformed file as JavaScript
	const compilerOptions: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.CommonJS,
	};

	const newSourceFile = transformedSourceFileInfo.toNewSourceFile();

	const program = ts.createProgram([newSourceFile.fileName], compilerOptions, {
		...ts.createCompilerHost(compilerOptions),
		getSourceFile: (fileName) => fileName === newSourceFile.fileName ? newSourceFile : undefined,
	});

	const { emitSkipped, diagnostics } = program.emit(undefined, (fileName, data) =>
	{
		if (fileName.endsWith('.js'))
		{
			const outputJsFilePath = path.join("build", fileName)
			console.log(outputJsFilePath);
			ts.sys.writeFile(outputJsFilePath, data);
		}
	});

	if (emitSkipped)
	{
		console.error("Emit failed with the following diagnostics:", diagnostics);
	} else
	{
		console.log(`Transformed JavaScript file emitted to: ${"JS"}`);
	}
};
