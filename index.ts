import * as ts from "typescript";

const program = ts.createProgram({
	rootNames: ["test.ts"],
	options: {}
});

const checker = program.getTypeChecker();

const prev: ts.Symbol[] = [];



const findSymbol = (node: ts.Node, name: string): ts.Symbol | undefined => {
	if(ts.isIdentifier(node)) {
		const symbol = checker.getSymbolAtLocation(node);
		if(symbol && symbol.name === name) {
			return symbol;
		}
	}
	
	const children = node.getChildren();
	for(const child of children) {
		const s = findSymbol(child, name);
		if(s) return s;
	}
}

const operatorsSource = program.getSourceFile("operators.ts")!;
const add = findSymbol(operatorsSource, "ADD");

const findSymbolMatch = (node: ts.Node, matchSymbol: ts.Symbol): ts.Symbol | undefined => {
	if(ts.isIdentifier(node)) {
		const symbol = checker.getSymbolAtLocation(node);
		if(symbol) {
			if(checker.getAliasedSymbol(symbol) === matchSymbol) {
				return symbol;
			}
		}
	}
	
	const children = node.getChildren();
	for(const child of children) {
		const s = findSymbolMatch(child, matchSymbol);
		if(s) return s;
	}
}

const testSource = program.getSourceFile("test.ts");
const addOp = findSymbolMatch(testSource!, add!);


const findArray = (node: ts.Node): ts.ArrayLiteralExpression | undefined => {
	if(ts.isArrayLiteralExpression(node)) {
		return node;
	}
	
	const children = node.getChildren();
	for(const child of children) {
		const a = findArray(child);
		if(a) return a;
	}
}

// console.log(findArray(testSource!));

const addMember = addOp?.getDeclarations()![0]!.parent!.parent!.parent!.parent!;
const arr = findArray(addMember)!;

const first = arr.elements[0] as ts.ArrayLiteralExpression;
const func = first.elements[2];

// @ts-ignore
delete func.parent;
console.log(func);
