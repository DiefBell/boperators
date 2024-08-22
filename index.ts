import * as ts from 'typescript';

// A helper function to create a CallExpression
function createCallExpression(node: ts.BinaryExpression, className: string, methodName: string): ts.CallExpression {
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
function visitNodeAndReplaceBinaryExpressions(node: ts.Node, context: ts.TransformationContext, className: string, methodName: string): ts.Node {
    if (ts.isBinaryExpression(node) && node.left.getText() === "v1" && node.right.getText() === "v2") {
        // Replace BinaryExpression with CallExpression
        return createCallExpression(node, className, methodName);
    }
    return ts.visitEachChild(node, child => visitNodeAndReplaceBinaryExpressions(child, context, className, methodName), context);
}

// Function to transform the source file
function transformSourceFile(sourceFile: ts.SourceFile, context: ts.TransformationContext, className: string, methodName: string): ts.SourceFile {
    const node = ts.visitNode(sourceFile, node => visitNodeAndReplaceBinaryExpressions(node, context, className, methodName));
	if(!ts.isSourceFile(node)) {
		throw new Error("Somehow got back an element this isn't a sourceFile");
	}
	return node;
}

// Function to emit the transformed source file to JS
function emitTransformedFile(sourceFile: ts.SourceFile, outputFileName: string) {
    const transformer = (context: ts.TransformationContext) => (file: ts.SourceFile) =>
        transformSourceFile(file, context, 'MyVector3', 'ADD[0][2]');

    const result = ts.transform(sourceFile, [transformer]);

    const printer = ts.createPrinter();
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;
    const resultCode = printer.printFile(transformedSourceFile);

    const outputFilePath = ts.sys.resolvePath(outputFileName);
    ts.sys.writeFile(outputFilePath, resultCode);
    console.log(`File emitted to: ${outputFilePath}`);

    result.dispose();
}

// Read and parse the TypeScript file
const fileName = 'test.ts'; // Change this to your TypeScript file
const sourceFile = ts.createSourceFile(
    fileName,
    ts.sys.readFile(fileName) || '',
    ts.ScriptTarget.Latest,
    true
);

// Transform and emit the file
emitTransformedFile(sourceFile, 'output.ts');
