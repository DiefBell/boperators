import ts from "typescript";
import * as path from "path";

import { fileURLToPath } from "bun";
import { type OperatorName, operators } from "./types/Operators";
import { getOperatorOverloads } from "./getOverloads";
export class OperatorOverrideManger
{
	private _program: ts.Program;
	private _checker: ts.TypeChecker;
	private _symbols: Map<OperatorName, ts.Symbol> = new Map();

	constructor(program: ts.Program)
	{
		this._program = program;
		this._checker = program.getTypeChecker();

		const __dirName = path.dirname(fileURLToPath(import.meta.url));
		const operatorFilePath = path.join(__dirName, "..", "lib", "operatorSymbols.ts");

		const operatorSourceFile = program.getSourceFile(operatorFilePath);
		if (!operatorSourceFile)
		{
			throw new Error("Failed to find operators source file - have you modified that packagey");
		}

		this._getOperatorSymbols(operatorSourceFile);
	}

	public test()
	{
		const overloads = getOperatorOverloads(this._program, Array.from(this._symbols.values()));
		for (const o of overloads)
		{
			console.log(o.toString());
		}
	}

	/**
     * Looks inside `operatorSymbols.ts` to get the `ts.Symbol` for the operators.
     */
	private _getOperatorSymbols(node: ts.Node)
	{
		if (
			ts.isVariableDeclaration(node)
			&& !!node.initializer
			&& ts.isCallExpression(node.initializer)
			&& !!node.initializer.expression
			&& ts.isIdentifier(node.initializer.expression)
			&& node.initializer.expression.escapedText === "Symbol"
			&& ts.isIdentifier(node.name)
			&& operators.includes(node.name.getText())
		)
		{
			const symbol = this._checker.getSymbolAtLocation(node.name);
			if (symbol)
			{
				this._symbols.set(node.name.getText() as OperatorName, symbol);
			}
		}

		node.forEachChild(this._getOperatorSymbols.bind(this));
	}

	/**
     * For a given symbol, check if it matches one of the symbols imported from our operators file,
     * then double check whether that symbol aliases one of the original symbols in the operators file.
     * @param symbol
     * @param imports
     */
	private _findMatchingOperatorSymbol(symbol: ts.Symbol, imports: ts.ImportDeclaration[]): OperatorName | undefined
	{
		const matchingImport = imports.find((i) =>
		{
			const symbol = this._checker.getSymbolAtLocation(i);
			return symbol === symbol;
		});

		if (!matchingImport)
		{
			return;
		}

		const aliasedSymbol = this._checker.getAliasedSymbol(symbol);
		if (!Object.values(this._symbols).includes(aliasedSymbol))
		{
			return;
		}

		console.log("HERE!");
		return aliasedSymbol.name as OperatorName;
	}

	// private _loadOverloadsFromNode(node: ts.Node, imports: ts.ImportDeclaration[]): void {
	//     if (isStaticPropertyDeclaration(node)) {
	//         const propertyName = node.name
	//         if (ts.isIdentifier(propertyName)) {
	//             const propertySymbol = this._checker.getSymbolAtLocation(propertyName);
	//             if(!propertySymbol) {
	//                 return;
	//             }
	//             const operatorName = this._findMatchingOperatorSymbol(propertySymbol, imports);
	//             console.log(operatorName);
	//         }
	//     }
	//     // if(
	//     //     ts.isIdentifier(node)
	//     //     // && isStaticPropertyDeclaration(node.parent)
	//     // ) {
	//     //     const symbol = this._checker.getSymbolAtLocation(node);
	//     //     if(symbol && symbol.flags & ts.SymbolFlags.Alias) {
	//     //         const aliased = this._checker.getAliasedSymbol(symbol);
	//     //         if(Object.values(this._symbols).includes(aliased)){
	//     //             console.log("FOUND!")
	//     //             console.log(node.parent.parent.parent.parent.getText());
	//     //         }
	//     //     }
	//     // }

	//     node.forEachChild((child) => this._loadOverloadsFromNode(child, imports));
	// }
}
