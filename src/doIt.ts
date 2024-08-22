import ts from 'typescript';
import * as path from "path";

export const doIt = () =>
{

	// A helper function to create a CallExpression
	function createCallExpression(node: ts.BinaryExpression, className: string, methodName: string): ts.CallExpression
	{
		return ts.factory.createCallExpression(
			ts.factory.createPropertyAccessExpression(
				ts.factory.createIdentifier(className),
				ts.factory.createIdentifier(methodName)
			),
			undefined,
			[node.left, node.right]
		);
	}

	// A function to visit and transform the nodes in the AST
	function visitNodeAndReplaceBinaryExpressions(node: ts.Node, context: ts.TransformationContext, className: string, methodName: string): ts.Node
	{
		if (ts.isBinaryExpression(node) && node.left.getText() === "v1" && node.right.getText() === "v2")
		{
			// Replace BinaryExpression with CallExpression
			return createCallExpression(node, className, methodName);
		}
		return ts.visitEachChild(node, child => visitNodeAndReplaceBinaryExpressions(child, context, className, methodName), context);
	}

	// Function to transform the source file
	function transformSourceFile(sourceFile: ts.SourceFile, context: ts.TransformationContext, className: string, methodName: string): ts.SourceFile
	{
		const node = ts.visitNode(sourceFile, node => visitNodeAndReplaceBinaryExpressions(node, context, className, methodName));
		if (!ts.isSourceFile(node))
		{
			throw new Error("Somehow got back an element this isn't a SourceFile");
		}
		return node;
	}

	// Function to emit the transformed source file as TypeScript and JS
	function emitTransformedFile(sourceFile: ts.SourceFile)
	{
		const transformer = (context: ts.TransformationContext) => (file: ts.SourceFile) =>
			transformSourceFile(file, context, 'MyVector3', 'ADD[0][2]');

		// Apply the transformation
		const result = ts.transform(sourceFile, [transformer]);
		const transformedSourceFile = result.transformed[0] as ts.SourceFile;

		// Emit the transformed TypeScript file
		const printer = ts.createPrinter();
		const transformedSourceCode = printer.printFile(transformedSourceFile);

		// debugging
		if(true) {
			const debugFileName = path.join("tmp", transformedSourceFile.fileName.replace(".ts", ".debug.ts"));
			const debugFileOutputPath = ts.sys.resolvePath(debugFileName);
			ts.sys.writeFile(debugFileOutputPath, transformedSourceCode);
			console.log(`Transformed TypeScript file emitted to: ${debugFileOutputPath}`);
		}


		// Emit the transformed file as JavaScript
		const compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.CommonJS,
		};

		const newSourceFile = ts.createSourceFile(
			transformedSourceFile.fileName,
			transformedSourceCode,
			ts.ScriptTarget.Latest,
			true
		);

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

		result.dispose();
	}

	// Read and parse the TypeScript file
	const filePath = "test/test.ts"; // Change this to your TypeScript file
	const fileName = path.basename(filePath);
	const sourceFile = ts.createSourceFile(
		fileName,
		ts.sys.readFile(filePath) ?? "",
		ts.ScriptTarget.Latest,
		true
	);

	// Transform and emit the files
	emitTransformedFile(sourceFile);

}