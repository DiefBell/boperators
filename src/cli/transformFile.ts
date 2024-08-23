import ts from "typescript";
import { replaceOperatorsInAst } from "./replaceOperatorsInAst";
import * as path from "path";

export class TransformedFileData implements Disposable
{
	private readonly _result: ts.TransformationResult<ts.SourceFile>;
	public readonly transformedSourceFile: ts.SourceFile;
	public readonly transformedSourceCode: string;

	public toNewSourceFile()
	{
		return ts.createSourceFile(
			this.transformedSourceFile.fileName,
			this.transformedSourceCode,
			ts.ScriptTarget.Latest,
			true
		);
	}

	constructor(
		result: ts.TransformationResult<ts.SourceFile>,
		transformedSourceFile: ts.SourceFile,
		transformedSourceCode: string
	)
	{
		this._result = result;
		this.transformedSourceFile = transformedSourceFile;
		this.transformedSourceCode = transformedSourceCode;
	}

	[Symbol.dispose]() {
		this._result.dispose();
	}
}

/**
 * 
 * @param sourceFile
 * @param emitTs 
 * @returns 
 * 
 * @example using transformed = transformSourceFile(sourceFile, true);
 */
export const transformSourceFile = (sourceFile: ts.SourceFile, emitTs: boolean = false): TransformedFileData =>
{
	const transformer = (context: ts.TransformationContext) => (file: ts.SourceFile) =>
		replaceOperatorsInAst(file, context, 'MyVector3', 'ADD[0][2]');

	// Apply the transformation
	const result = ts.transform(sourceFile, [transformer]);
	const transformedSourceFile = result.transformed[0] as ts.SourceFile;

	// Emit the transformed TypeScript file
	const printer = ts.createPrinter();
	const transformedSourceCode = printer.printFile(transformedSourceFile);

	// debugging
	if(emitTs) {
		const debugFileName = path.join("tmp", transformedSourceFile.fileName.replace(".ts", ".debug.ts"));
		const debugFileOutputPath = ts.sys.resolvePath(debugFileName);
		ts.sys.writeFile(debugFileOutputPath, transformedSourceCode);
		console.log(`Transformed TypeScript file emitted to: ${debugFileOutputPath}`);
	}

	return new TransformedFileData(result, transformedSourceFile, transformedSourceCode);
}