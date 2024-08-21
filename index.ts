import ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as assert from "assert/strict"
import type { Identifier } from "typescript";



const program = ts.createProgram({
	rootNames: ["test.ts"],
	options: {}
});

const typeChecker = program.getTypeChecker();

const sourceFile = program.getSourceFile("test.ts")!;

const findAddMember = (node: ts.Node): ts.PropertyDeclaration | null => {
	if(ts.isClassDeclaration(node)) {
		for(const child of node.members.filter(ts.isPropertyDeclaration)) {
			if(child.name.getText() === "ADD") {
				return child;
			}
		}
		return null;
	}

	if(ts.isSourceFile(node)) {
		for(const statement of node.statements) {
			const m = findAddMember(statement);
			if(m) {
				return m;
			}
		}
		return null;
	}

	return null;
};

const member = findAddMember(sourceFile)!;

type Overload = { leftType: ts.Type, rightType: ts.Type, func: ts.ArrowFunction | ts.FunctionExpression };

const findFirstAddOperatorOverload = (propDec: ts.PropertyDeclaration): Overload => {
	const initializer = propDec.initializer! as ts.ArrayLiteralExpression;

	const first = initializer.elements[0]! as ts.ArrayLiteralExpression;

	const [ left, right, func ] = first.elements as any as [ts.Identifier, ts.Identifier, ts.ArrowFunction];

	const leftSymbol = typeChecker.getSymbolAtLocation(left)!;
	const leftType = typeChecker.getTypeOfSymbolAtLocation(leftSymbol, left);

	const rightSymbol = typeChecker.getSymbolAtLocation(right)!;
	const rightType = typeChecker.getTypeOfSymbolAtLocation(rightSymbol, right);

	return { leftType, rightType, func };
};

const addOperatorOverload = findFirstAddOperatorOverload(member)!;
// console.log(addOperatorOverload.leftType)

// console.log(addOperatorOverload);

const createAddOperatorCallExpression = (
	func: ts.ArrowFunction,
	left: ts.Expression,
	right: ts.Expression
): ts.CallExpression => {
	return ts.factory.createCallExpression(func, [], [left, right])
};

const getConstructorType = (identifier: Identifier): ts.Type | null => {
	const type = typeChecker.getTypeAtLocation(identifier);

	const symbol = type.getSymbol();
	if(!symbol) {
		return null;
	}

	const valueDeclaration = symbol.valueDeclaration;
	if(!valueDeclaration || !ts.isClassDeclaration(valueDeclaration)) {
		return null;
	}

	const constructorDeclaration = valueDeclaration.members.find(ts.isConstructorDeclaration);
	if(!constructorDeclaration) {
		return null;
	}

	return typeChecker.getTypeAtLocation(constructorDeclaration);
}

/**
 * `null` if element has not been updated
 * @param node 
 * @returns 
 */
const updateNode = <T extends ts.Node>(node: T): T => {
	if(!node) {
		return node;
	}

	if(ts.isSourceFile(node)) {
		const updatedStatements = node.statements.map(updateNode);
		return ts.factory.updateSourceFile(node, updatedStatements) as any as T;
	}

	if(ts.isVariableStatement(node)) {
		// console.log("VariableStatement: ", node.getText());

		const updatedVarDecList = updateNode(node.declarationList);
		
		return ts.factory.updateVariableStatement(node, undefined, updatedVarDecList) as any as T;
	}

	if(ts.isVariableDeclarationList(node)) {
		// console.log("VariableDeclarationList: ", node.getText());
		const updatedDeclarations = node.declarations.map(updateNode);
		return ts.factory.updateVariableDeclarationList(node, updatedDeclarations) as any as T;
	}

	if(ts.isVariableDeclaration(node)) {
		// console.log("VariableDeclaration: ", node.getText());
		const updatedInitializer = !!node.initializer
			&& ts.isBinaryExpression(node.initializer)
			&& updateNode(node.initializer);
		
		if(!updatedInitializer) {
			return node;
		}

		return ts.factory.updateVariableDeclaration(node,
			node.name,
			node.exclamationToken,
			node.type,
			updatedInitializer
		) as any as T;
	}

	if(ts.isBinaryExpression(node)) {
		console.log("BinaryExpression: ", node.getText(), "\n");
		if(!ts.isPlusToken(node.operatorToken)) {
			return node;
		}

		const { left, right } = node;
		if(!ts.isIdentifier(left)) {
			return node;
		}

		if(!ts.isIdentifier(right)) {
			return node;
		}

		const leftConstructorType = getConstructorType(left);
		if(!leftConstructorType) {
			return node;
		}
		console.log(typeChecker.isTypeAssignableTo(leftConstructorType, addOperatorOverload.leftType));

		const rightConstructorType = getConstructorType(right);
		if(!rightConstructorType) {
			return node;
		}

		console.log(typeChecker.isTypeAssignableTo(rightConstructorType, addOperatorOverload.rightType));







		const rightSymbol = typeChecker.getSymbolAtLocation(right);
		if(!rightSymbol) {
			return node;
		}
		const rightType = typeChecker.getTypeOfSymbolAtLocation(rightSymbol, right);



		// console.log(
		// 	// leftClassType === addOperatorOverload.leftType
		// 	typeChecker.isTypeAssignableTo(leftType, addOperatorOverload.leftType)
		// );
		// console.log(
		// 	typeChecker.isTypeAssignableTo(rightType, addOperatorOverload.rightType)
		// );
		
		// const rightTypeSymbol = checker.getTypeAtLocation(node.right).getSymbol();

		// console.log(leftTypeSymbol)
	}

	return node;
}

updateNode(sourceFile);

// const findSymbol = (node: ts.Node, name: string): ts.Symbol | undefined =>
// {
// 	if (ts.isIdentifier(node))
// 	{
// 		const symbol = checker.getSymbolAtLocation(node);
// 		if (symbol && symbol.name === name)
// 		{
// 			return symbol;
// 		}
// 	}

// 	const children = node.getChildren();
// 	for (const child of children)
// 	{
// 		const s = findSymbol(child, name);
// 		if (s) return s;
// 	}
// }

// const findSymbolMatch = (node: ts.Node, matchSymbol: ts.Symbol): ts.Symbol | undefined =>
// {
// 	if (ts.isIdentifier(node))
// 	{
// 		const symbol = checker.getSymbolAtLocation(node);
// 		if (symbol)
// 		{
// 			if (symbol=== matchSymbol)
// 			{
// 				return symbol;
// 			}
// 		}
// 	}

// 	const children = node.getChildren();
// 	for (const child of children)
// 	{
// 		const s = findSymbolMatch(child, matchSymbol);
// 		if (s) return s;
// 	}
// }

// const testSource = program.getSourceFile("test.ts");

// // const operatorsSource = program.getSourceFile("operators.ts")!;
// const add = findSymbol(testSource!, "ADD");

// const addOp = findSymbolMatch(testSource!, add!);
// // console.log("addOp", addOp);

// const findArray = (node: ts.Node): ts.ArrayLiteralExpression | undefined =>
// {
// 	if (ts.isArrayLiteralExpression(node))
// 	{
// 		return node;
// 	}

// 	const children = node.getChildren();
// 	for (const child of children)
// 	{
// 		const a = findArray(child);
// 		if (a) return a;
// 	}
// }

// // console.log(findArray(testSource!));

// const addMember = addOp?.getDeclarations()![0]
// const arr = findArray(addMember!);
// // console.log(arr);

// const first = arr!.elements[0] as ts.ArrayLiteralExpression;
// const func = first.elements[2] as ts.ArrowFunction;

// let bins: ts.BinaryExpression[] = [];
// const findBinaries = (node: ts.Node) =>
// {
// 	if (ts.isBinaryExpression(node))
// 	{
// 		bins.push(node);
// 	}

// 	ts.forEachChild(node, findBinaries);
// }

// findBinaries(testSource!);
// const binExp = bins[bins.length - 1];
// const lhs = checker.getTypeAtLocation(binExp.left);
// const rhs = checker.getTypeAtLocation(binExp.right);
// const call = ts.factory.createCallExpression(func, [], [binExp.left, binExp.right]);

// const varDec = binExp.parent as ts.VariableDeclaration;

// const newVarDec = ts.factory.updateVariableDeclaration(
// 	varDec,
// 	varDec.name,
// 	varDec.exclamationToken,
// 	varDec.type,
// 	call
// );

// const varDecList = varDec.parent as ts.VariableDeclarationList;
// const newVarDecList = ts.factory.updateVariableDeclarationList(
// 	varDecList,
// 	[newVarDec]
// );

// const varStatement = varDecList.parent as ts.VariableStatement;
// const newVarStatement = ts.factory.updateVariableStatement(
// 	varStatement,
// 	undefined,
// 	newVarDecList
// );



















// // const sourceFile = varStatement.parent as ts.SourceFile;

// const updatedSourceFile = ts.factory.updateSourceFile(
// 	testSource!,
// 	testSource!.statements.map((statement) => {
// 		if(statement === varStatement) {
// 			return newVarStatement;
// 		}
// 		return statement;
// 	})
// );


// // console.log(updatedSourceFile);

// updatedSourceFile.fileName = updatedSourceFile.fileName.replace(".ts", "-updated.ts");

// const funcCalls: ts.CallExpression[] = [];
// const findFuncCalls = (node: ts.Node) =>
// {
// 	if (ts.isCallExpression(node))
// 	{
// 		funcCalls.push(node);
// 		return;
// 	}

// 	node.forEachChild(findFuncCalls);
// }

// findFuncCalls(updatedSourceFile);


// const virtualFiles = new Map<string, ts.SourceFile>();
// virtualFiles.set(updatedSourceFile.fileName, updatedSourceFile);

// const compilerOptions: ts.CompilerOptions = {
// 	// Your desired compiler options
// 	target: ts.ScriptTarget.ESNext,
// 	module: ts.ModuleKind.CommonJS,
// };

// console.log("CWD", process.cwd());

// const customCompilerHost: ts.CompilerHost = {
// 	getSourceFile: (fileName: string) =>
// 	{
// 		console.log("getSourceFile", fileName, virtualFiles.has(fileName));
// 		return virtualFiles.get(fileName);
// 	},
// 	// Implement other methods as needed for your specific use case
// 	writeFile: (fileName, data) => {
// 		console.log("WRITING", data.toString());
// 		fs.writeFileSync(fileName.replace(".ts", ".js"), data);
// 	},
// 	getDefaultLibFileName: () => 'lib.d.ts',
// 	getCurrentDirectory: () => process.cwd(),
// 	getCanonicalFileName: (fileName: string): string => fileName,
// 	useCaseSensitiveFileNames: () => true,
// 	getNewLine: (): string => '\n',
// 	fileExists: (fileName: string): boolean =>
// 	{
// 		console.log("fileExists", fileName, virtualFiles.has(fileName));
// 		return virtualFiles.has(fileName);
// 	},
// 	readFile: (fileName: string): string | undefined =>
// 	{
// 		console.log("NO SF");
// 		const sf = virtualFiles.get(fileName);
// 		console.log("NO SF");
// 		if (sf)
// 		{
// 			console.log("A")
// 			const sfContent = ts.createPrinter().printNode(ts.EmitHint.Unspecified, sf, sf);
// 			console.log("B")
// 			return sfContent;
// 		}
// 		return undefined;
// 	},
// 	// directoryExists: (directoryName: string): boolean =>
// 	// {
// 	// 	try
// 	// 	{
// 	// 		return fs.statSync(directoryName).isDirectory();
// 	// 	} catch
// 	// 	{
// 	// 		return false;
// 	// 	}
// 	// },
// 	// getDirectories: (directoryName: string): string[] =>
// 	// {
// 	// 	return fs.readdirSync(directoryName).filter(name => fs.statSync(path.join(directoryName, name)).isDirectory());

// 	// },
// 	// resolveModuleNames: (
// 	// 	moduleNames: string[],
// 	// 	containingFile: string,
// 	// 	reusedNames?: string[],
// 	// 	redirectedReferences?: ts.ResolvedProjectReference | undefined,
// 	// 	options?
// 	// ): (ts.ResolvedModule | undefined)[] =>
// 	// {
// 	// 	// Implement module resolution logic here
// 	// 	return []
// 	// },
// 	// getDefaultLibLocation(): string
// 	// {
// 	// 	return 'lib.d.ts';
// 	// }
// };

// console.log(1, "UPDATED FILENAME", updatedSourceFile.fileName)
// const program2 = ts.createProgram([updatedSourceFile.fileName], compilerOptions, customCompilerHost);

// console.log(updatedSourceFile.getChildCount())
// console.log(2,
// 	// virtualFiles.get(updatedSourceFile.fileName)
// )
// const emitResult = program2.emit(updatedSourceFile);

// console.log(3)
// console.log(emitResult);

// if (emitResult.diagnostics.length > 0)
// {
// 	// Handle errors
// 	console.error(ts.formatDiagnostics(emitResult.diagnostics, {
// 		getCanonicalFileName: fileName => fileName,
// 		getCurrentDirectory: () => '',
// 		getNewLine: () => '\n'
// 	}));
// } else
// {
// 	console.log('Transpilation successful');
// }
