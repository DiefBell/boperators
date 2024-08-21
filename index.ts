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


// const findAddSymbol = (node: ts.Node, name: string): ts.Symbol | undefined =>
// {
// 	if (ts.isIdentifier(node))
// 	{
// 		const symbol = checker.getSymbolAtLocation(node);
// 		if (symbol && symbol.name === name)
// 		{
// 			return symbol;
// 		}
// 	}


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

// DIEF: MAKE THIS ALSO RETURN WHETHER OR NOT IT GOT UPDATED!
const updateNode = <T extends ts.Node>(node: T): T => {
	if(!node) {
		return node;
	}

	const isUpdated = (node: ts.Node): boolean => Object.hasOwn(node, "original");

	if(ts.isSourceFile(node)) {
		// console.log("Source file!");
		const updatedStatements = node.statements.map(updateNode);
		node.fileName = node.fileName.replace(".ts", ".updated.ts");
		const updatedSourceFile = ts.factory.updateSourceFile(node, updatedStatements) as any as T;
		// console.log(updatedSourceFile.getText());
		return updatedSourceFile;
	}

	if(ts.isVariableStatement(node)) {
		// console.log("VariableStatement: ", node.getText());

		const updatedVarDecList = updateNode(node.declarationList);
		
		return ts.factory.updateVariableStatement(node, undefined, updatedVarDecList) as any as T;
	}

	if(ts.isVariableDeclarationList(node)) {
		// console.log("VariableDeclarationList: ", node.getText());
		const declarations = node.declarations.map(updateNode);
		const updatedDeclarations = declarations.filter(isUpdated);

		if(updatedDeclarations.length === 0) {
			return node;
		}

		console.log("DECS", node.getText());

		return ts.factory.updateVariableDeclarationList(node, updatedDeclarations) as any as T;
	}

	if(ts.isVariableDeclaration(node)) {
		// console.log("VariableDeclaration: ", node.getText());
		const updatedInitializer = !!node.initializer
			&& ts.isBinaryExpression(node.initializer)
			&& updateNode<ts.Expression>(node.initializer);

		if(!updatedInitializer) {
			return node;
		}

		const updatedVariableDelcaration = ts.factory.updateVariableDeclaration(node,
			node.name,
			node.exclamationToken,
			node.type,
			updatedInitializer
		);
		
		return updatedVariableDelcaration as any as T;
	}

	if(ts.isBinaryExpression(node)) {
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

		const isConstructorFor = (t1: ts.Type, t2: ts.Type): boolean => 
			typeChecker.isTypeAssignableTo(t1, t2) && typeChecker.isTypeAssignableTo(t2, t1);

		if(!isConstructorFor(leftConstructorType, addOperatorOverload.leftType)) {
			return node;
		}

		console.log("HERE A")

		const rightConstructorType = getConstructorType(right);
		if(!rightConstructorType) {
			return node;
		}

		if(!isConstructorFor(rightConstructorType, addOperatorOverload.rightType)) {
			return node;
		}

		console.log("HERE B")

		return ts.factory.createCallExpression(addOperatorOverload.func, [], [left, right]) as any as T;
	}

	return node;
}

const updatedSourceFile = updateNode(sourceFile);

const s = updatedSourceFile.statements[3];
console.log(s.getText(updatedSourceFile));










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

const findBinaryExpression = (node: ts.Node): ts.Node | null => {
	if(ts.isBinaryExpression(node)) {
		return node;
	}

	if(ts.isSourceFile(node)) {
		for(const statement of node.statements) {
			const b = findBinaryExpression(statement);
			if(b) {
				return b
			}
		}
	}

	for(const child of node.getChildren()) {
		const b = findBinaryExpression(child);
		if(b) return b;
	}

	return null;
}




// const callExpressions: ts.CallExpression[] = [];
// const findCallExpressions = (node: ts.Node) => {
// 	if(ts.isSourceFile(node)) {
// 		for(const statement of node.statements) {
// 			findCallExpressions(statement);
// 		}
// 	}

// 	if(ts.isCallExpression(node)) {
// 		callExpressions.push(node);
// 	}

// 	try {
// 		for(const child of node.getChildren()) {
// 			findCallExpressions(child);
// 		}
// 	} catch {}
// }

// findCallExpressions(updatedSourceFile);
// console.log(callExpressions.length);

// const c = findCallExpression(updatedSourceFile);
// console.log(c?.parent?.parent?.getText());
// const bin = findBinaryExpression(updatedSourceFile);


// const p = bin!.parent?.parent?.parent?.parent?.parent?.parent?.parent?.parent?.parent;
// // @ts-ignore
// delete p?.parent;
// // @ts-ignore
// delete p?.original;
// console.log(p);
// console.log(ts.isCallExpression(p));

// cons


process.exit(0);

console.log(1, "UPDATED FILENAME", updatedSourceFile.fileName)
const program2 = ts.createProgram([updatedSourceFile.fileName], compilerOptions, customCompilerHost);

console.log("1b")
// console.log(updatedSourceFile)
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
