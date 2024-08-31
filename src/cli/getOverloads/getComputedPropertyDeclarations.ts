import ts from "typescript";

/**
 * Returns the symbols for each of the property declarations
 * that have a computed property name i.e. in square brackets
 * @param sourceFile
 * @returns
 */
export const getComputedPropertyDeclarations = (sourceFile: ts.SourceFile): ts.PropertyDeclaration[] =>
{
	const declarations: ts.PropertyDeclaration[] = [];

	const getPropertyDeclarationsFromNode = (node: ts.Node): void =>
	{
		if (ts.isPropertyDeclaration(node) && ts.isComputedPropertyName(node.name))
		{
			declarations.push(node);
			return;
		}

		node.forEachChild(getPropertyDeclarationsFromNode);
	};

	getPropertyDeclarationsFromNode(sourceFile);
	return declarations;
};
