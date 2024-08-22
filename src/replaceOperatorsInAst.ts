import ts from "typescript";


const createCallExpression = (node: ts.BinaryExpression, className: string, methodName: string): ts.CallExpression =>
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
export const visitNodeAndReplaceBinaryExpressions = (node: ts.Node, context: ts.TransformationContext, className: string, methodName: string): ts.Node =>
{
	if (ts.isBinaryExpression(node) && node.left.getText() === "v1" && node.right.getText() === "v2")
	{
		// Replace BinaryExpression with CallExpression
		return createCallExpression(node, className, methodName);
	}
	return ts.visitEachChild(node, child => visitNodeAndReplaceBinaryExpressions(child, context, className, methodName), context);
}

// Function to transform the source file
export const replaceOperatorsInAst = (sourceFile: ts.SourceFile, context: ts.TransformationContext, className: string, methodName: string): ts.SourceFile =>
{
	const node = ts.visitNode(sourceFile, node => visitNodeAndReplaceBinaryExpressions(node, context, className, methodName));
	if (!ts.isSourceFile(node))
	{
		throw new Error("Somehow got back an element this isn't a SourceFile");
	}
	return node;
}