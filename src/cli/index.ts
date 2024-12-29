import * as path from "path";
import { Project as TsMorphProject, SyntaxKind } from "ts-morph";
import { OverloadStore } from "./OverloadStore";
import { isOperatorSyntaxKind } from "./operatorMap";

const testFilesRoot = path.join(
	import.meta.dir,
	"..", // src
	"..", // .
	"test"
);
const testFiles = [
	path.join(testFilesRoot, "vector3.ts"),
	path.join(testFilesRoot, "test.ts"),
];

// Initialise the ts-morph project
const project = new TsMorphProject();
project.addSourceFilesAtPaths(testFiles);

// Get all overloads
const overloadStore = new OverloadStore(project);
// console.log(overloadStore.toString());

// Process the test.ts file
const testFile = project.getSourceFileOrThrow(testFiles[1]);

const binaryExpressions = testFile.getDescendantsOfKind(
	SyntaxKind.BinaryExpression
);

binaryExpressions.forEach((expression) =>
{
	const text = expression.getText();
	console.log(text);

	const operatorKind = expression.getOperatorToken().getKind();
	if (!isOperatorSyntaxKind(operatorKind))
	{
		console.log(`Operator kind ${SyntaxKind[operatorKind]} is not an operator we care about`);
		return; // Not an operator we care about
	}

	const lhs = expression.getLeft();
	let leftType = lhs.getType().getText();
	// Ensure leftType is "number" for numeric literals
	if (lhs.getKind() === SyntaxKind.NumericLiteral)
	{
		leftType = "number";
	}

	const rhs = expression.getRight();
	let rightType = rhs.getType().getText();
	// Ensure rightType is "number" for numeric literals
	if (rhs.getKind() === SyntaxKind.NumericLiteral)
	{
		rightType = "number";
	}

	const overloadsForOperator = overloadStore.get(operatorKind);
	if (!overloadsForOperator) return; // No overloads for this operator

	const overloadsForLhs = overloadsForOperator.get(leftType);
	if (!overloadsForLhs) return; // No overloads for this LHS type

	const overloadDesc = overloadsForLhs.get(rightType);
	if (!overloadDesc) return; // No overloads for this RHS type

	const { className, propName, index, isStatic } = overloadDesc;

	const overloadCall = isStatic
		? `${className}${propName}[${index}](${lhs.getText()}, ${rhs.getText()})`
		: `${lhs.getText()}${propName}[${index}](${rhs.getText()})`;

	expression.replaceWithText(overloadCall);
});

// Print the modified content to the console
console.log(testFile.getFullText());
