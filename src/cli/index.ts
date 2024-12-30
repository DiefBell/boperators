import * as path from "path";
import { Project as TsMorphProject, SyntaxKind } from "ts-morph";
import { OverloadStore } from "./OverloadStore";
import { isOperatorSyntaxKind } from "./operatorMap";
import { ErrorManager } from "./ErrorManager";

const testFilesRoot = path.join(
	import.meta.dir,
	"..", // src
	"..", // .
	"test"
);
const testFiles = [
	path.join(testFilesRoot, "Vector3.ts"),
	path.join(testFilesRoot, "test.ts"),
	// uncomment this to check error logging is working correctly
	path.join(testFilesRoot, "BadVector3.ts"),
];

const project = new TsMorphProject();
project.addSourceFilesAtPaths(testFiles);

const errorManager = new ErrorManager(process.argv.includes("--error-on-warning"));
const overloadStore = new OverloadStore(project, errorManager);
errorManager.throwIfErrorsElseLogWarnings();

// Process the test.ts file
const testFile = project.getSourceFileOrThrow(testFiles[1]);

const binaryExpressions = testFile.getDescendantsOfKind(
	SyntaxKind.BinaryExpression
);

binaryExpressions.forEach((expression) =>
{
	const operatorKind = expression.getOperatorToken().getKind();
	if (!isOperatorSyntaxKind(operatorKind))
	{
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
// console.log(testFile.getFullText());
