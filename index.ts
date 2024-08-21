import ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const program = ts.createProgram({
	rootNames: ["test.ts"],
	options: {}
});

const checker = program.getTypeChecker();


const findSymbol = (node: ts.Node, name: string): ts.Symbol | undefined =>
{
	if (ts.isIdentifier(node))
	{
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol && symbol.name === name)
		{
			return symbol;
		}
	}

	const children = node.getChildren();
	for (const child of children)
	{
		const s = findSymbol(child, name);
		if (s) return s;
	}
}

const findSymbolMatch = (node: ts.Node, matchSymbol: ts.Symbol): ts.Symbol | undefined =>
{
	if (ts.isIdentifier(node))
	{
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol)
		{
			if (symbol=== matchSymbol)
			{
				return symbol;
			}
		}
	}

	const children = node.getChildren();
	for (const child of children)
	{
		const s = findSymbolMatch(child, matchSymbol);
		if (s) return s;
	}
}

const testSource = program.getSourceFile("test.ts");

// const operatorsSource = program.getSourceFile("operators.ts")!;
const add = findSymbol(testSource!, "ADD");

const addOp = findSymbolMatch(testSource!, add!);
// console.log("addOp", addOp);

const findArray = (node: ts.Node): ts.ArrayLiteralExpression | undefined =>
{
	if (ts.isArrayLiteralExpression(node))
	{
		return node;
	}

	const children = node.getChildren();
	for (const child of children)
	{
		const a = findArray(child);
		if (a) return a;
	}
}

// console.log(findArray(testSource!));

const addMember = addOp?.getDeclarations()![0]
const arr = findArray(addMember!);
// console.log(arr);

const first = arr!.elements[0] as ts.ArrayLiteralExpression;
const func = first.elements[2] as ts.ArrowFunction;

let bins: ts.BinaryExpression[] = [];
const findBinaries = (node: ts.Node) =>
{
	if (ts.isBinaryExpression(node))
	{
		bins.push(node);
	}

	ts.forEachChild(node, findBinaries);
}

findBinaries(testSource!);
const binExp = bins[bins.length - 1];
const lhs = checker.getTypeAtLocation(binExp.left);
const rhs = checker.getTypeAtLocation(binExp.right);
const call = ts.factory.createCallExpression(func, [], [binExp.left, binExp.right]);

const varDec = binExp.parent as ts.VariableDeclaration;

const newVarDec = ts.factory.updateVariableDeclaration(
	varDec,
	varDec.name,
	varDec.exclamationToken,
	varDec.type,
	call
);

const varDecList = varDec.parent as ts.VariableDeclarationList;
const newVarDecList = ts.factory.updateVariableDeclarationList(
	varDecList,
	[newVarDec]
);

const varStatement = varDecList.parent as ts.VariableStatement;
const newVarStatement = ts.factory.updateVariableStatement(
	varStatement,
	undefined,
	newVarDecList
);

// const sourceFile = varStatement.parent as ts.SourceFile;

const updatedSourceFile = ts.factory.updateSourceFile(
	testSource!,
	testSource!.statements.map((statement) => {
		if(statement === varStatement) {
			return newVarStatement;
		}
		return statement;
	})
);


// console.log(updatedSourceFile);

updatedSourceFile.fileName = updatedSourceFile.fileName.replace(".ts", "-updated.ts");

const funcCalls: ts.CallExpression[] = [];
const findFuncCalls = (node: ts.Node) =>
{
	if (ts.isCallExpression(node))
	{
		funcCalls.push(node);
		return;
	}

	node.forEachChild(findFuncCalls);
}

findFuncCalls(updatedSourceFile);


const virtualFiles = new Map<string, ts.SourceFile>();
virtualFiles.set(updatedSourceFile.fileName, updatedSourceFile);

const compilerOptions: ts.CompilerOptions = {
	// Your desired compiler options
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.CommonJS,
};

console.log("CWD", process.cwd());

const customCompilerHost: ts.CompilerHost = {
	getSourceFile: (fileName: string) =>
	{
		console.log("getSourceFile", fileName, virtualFiles.has(fileName));
		return virtualFiles.get(fileName);
	},
	// Implement other methods as needed for your specific use case
	writeFile: (fileName, data) => {
		console.log("WRITING", data.toString());
		fs.writeFileSync(fileName.replace(".ts", ".js"), data);
	},
	getDefaultLibFileName: () => 'lib.d.ts',
	getCurrentDirectory: () => process.cwd(),
	getCanonicalFileName: (fileName: string): string => fileName,
	useCaseSensitiveFileNames: () => true,
	getNewLine: (): string => '\n',
	fileExists: (fileName: string): boolean =>
	{
		console.log("fileExists", fileName, virtualFiles.has(fileName));
		return virtualFiles.has(fileName);
	},
	readFile: (fileName: string): string | undefined =>
	{
		console.log("NO SF");
		const sf = virtualFiles.get(fileName);
		console.log("NO SF");
		if (sf)
		{
			console.log("A")
			const sfContent = ts.createPrinter().printNode(ts.EmitHint.Unspecified, sf, sf);
			console.log("B")
			return sfContent;
		}
		return undefined;
	},
	// directoryExists: (directoryName: string): boolean =>
	// {
	// 	try
	// 	{
	// 		return fs.statSync(directoryName).isDirectory();
	// 	} catch
	// 	{
	// 		return false;
	// 	}
	// },
	// getDirectories: (directoryName: string): string[] =>
	// {
	// 	return fs.readdirSync(directoryName).filter(name => fs.statSync(path.join(directoryName, name)).isDirectory());

	// },
	// resolveModuleNames: (
	// 	moduleNames: string[],
	// 	containingFile: string,
	// 	reusedNames?: string[],
	// 	redirectedReferences?: ts.ResolvedProjectReference | undefined,
	// 	options?
	// ): (ts.ResolvedModule | undefined)[] =>
	// {
	// 	// Implement module resolution logic here
	// 	return []
	// },
	// getDefaultLibLocation(): string
	// {
	// 	return 'lib.d.ts';
	// }
};

console.log(1, "UPDATED FILENAME", updatedSourceFile.fileName)
const program2 = ts.createProgram([updatedSourceFile.fileName], compilerOptions, customCompilerHost);

console.log(updatedSourceFile.getChildCount())
console.log(2,
	// virtualFiles.get(updatedSourceFile.fileName)
)
const emitResult = program2.emit(updatedSourceFile);

console.log(3)
console.log(emitResult);

if (emitResult.diagnostics.length > 0)
{
	// Handle errors
	console.error(ts.formatDiagnostics(emitResult.diagnostics, {
		getCanonicalFileName: fileName => fileName,
		getCurrentDirectory: () => '',
		getNewLine: () => '\n'
	}));
} else
{
	console.log('Transpilation successful');
}
