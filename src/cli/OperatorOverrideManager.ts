
import ts from "typescript";
import * as fs from "node:fs";
import * as path from "path";

import { ADD, DIVIDE, MULTIPLY, SUBTRACT } from "../lib";
import { isStaticMethodDeclaration } from "./astUtils";
import { fileURLToPath } from "bun";

const OPERATOR_SYMBOLS_FILE = "operatorSymbols.ts";

type OperatorOverride = {
    leftType: new(...args: unknown[]) => unknown;
    rightType: new(...args: unknown[]) => unknown;
    func: (a: unknown, b: unknown) => unknown;
}

enum OperatorS {
    ADD = "ADD",
    SUBTRACT = "SUBTRACT",
    MULTIPLY = "MULTIPLY",
    DIVIDE = "DIVIDE"
}

const operators = Object.keys(OperatorS);
type Operator =  keyof typeof OperatorS;

export class OperatorOverrideManger
{
    [ADD]: OperatorOverride[] = [];
    [SUBTRACT]: OperatorOverride[] = [];
    [MULTIPLY]: OperatorOverride[] = [];
    [DIVIDE]: OperatorOverride[] = [];

    private _checker: ts.TypeChecker;
    private _symbols: Record<Operator, ts.Symbol | undefined> = {
        ADD: undefined,
        SUBTRACT: undefined,
        MULTIPLY: undefined,
        DIVIDE: undefined
    };
    
    constructor(program: ts.Program)
    {
        this._checker = program.getTypeChecker();
        
        const __dirName = path.dirname(fileURLToPath(import.meta.url));
        const operatorFilePath = path.join(__dirName, "..", "lib", "operatorSymbols.ts");
        
        const operatorSourceFile = program.getSourceFile(operatorFilePath);
        if(!operatorSourceFile)
        {
            throw new Error("Failed to find operators source file - have you modified that packagey")
        }

        this._getOperatorSymbols(operatorSourceFile);
    }

    private _getOperatorSymbols(node: ts.Node) {
        if(
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
            const name = node.name.getText();
            const symbol = this._checker.getSymbolAtLocation(node.name)
            this._symbols[name as Operator] = symbol;
        }

        if(ts.isExpressionStatement(node))
        {
            if(ts.isIdentifier(node))
            {

            }
        }

        node.forEachChild(this._getOperatorSymbols.bind(this));
    }

    public getOperatorsFromFile(file: ts.SourceFile): void
    {
        this._getOperatorsFromNode(file);
    }

    private _getOperatorsFromNode(node: ts.Node): void
    {
        if(
            ts.isIdentifier(node)
        ) {
            const symbol = this._checker.getSymbolAtLocation(node);
            if(symbol && symbol.flags & ts.SymbolFlags.Alias) {
                const aliased = this._checker.getAliasedSymbol(symbol);
                if(Object.values(this._symbols).includes(aliased)){
                    console.log("FOUND!")
                    return;
                }
            }
        }

        node.forEachChild(this._getOperatorsFromNode.bind(this));
    }
}
