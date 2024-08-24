
import ts from "typescript";
import * as fs from "node:fs";
import * as path from "path";

import { ADD, DIVIDE, MULTIPLY, SUBTRACT } from "../lib";
import { isStaticPropertyDeclaration } from "./astUtils";
import { fileURLToPath } from "bun";

const OPERATOR_SYMBOLS_FILE = "operatorSymbols.ts";

type OperatorOverride = {
    leftType: new (...args: unknown[]) => unknown;
    rightType: new (...args: unknown[]) => unknown;
    func: (a: unknown, b: unknown) => unknown;
}

enum OperatorS {
    ADD = "ADD",
    SUBTRACT = "SUBTRACT",
    MULTIPLY = "MULTIPLY",
    DIVIDE = "DIVIDE"
}

type OperatorName = keyof typeof OperatorS;

const operators = Object.keys(OperatorS);

export class OperatorOverrideManger {
    [ADD]: OperatorOverride[] = [];
    [SUBTRACT]: OperatorOverride[] = [];
    [MULTIPLY]: OperatorOverride[] = [];
    [DIVIDE]: OperatorOverride[] = [];

    private _checker: ts.TypeChecker;
    private _symbols: Map<OperatorName, ts.Symbol> = new Map();

    constructor(program: ts.Program) {
        this._checker = program.getTypeChecker();

        const __dirName = path.dirname(fileURLToPath(import.meta.url));
        const operatorFilePath = path.join(__dirName, "..", "lib", "operatorSymbols.ts");

        const operatorSourceFile = program.getSourceFile(operatorFilePath);
        if (!operatorSourceFile) {
            throw new Error("Failed to find operators source file - have you modified that packagey")
        }

        this._getOperatorSymbols(operatorSourceFile);
    }

    /**
     * Looks inside `operatorSymbols.ts` to get the `ts.Symbol` for the operators.
     */
    private _getOperatorSymbols(node: ts.Node) {
        if (
            ts.isVariableDeclaration(node)
            && !!node.initializer
            && ts.isCallExpression(node.initializer)
            && !!node.initializer.expression
            && ts.isIdentifier(node.initializer.expression)
            && node.initializer.expression.escapedText === "Symbol"
            && ts.isIdentifier(node.name)
            && operators.includes(node.name.getText())
        ) {
            const symbol = this._checker.getSymbolAtLocation(node.name)
            if (symbol) {
                this._symbols.set(node.name.getText() as OperatorName, symbol);
            }
        }

        node.forEachChild(this._getOperatorSymbols.bind(this));
    }

    /**
     * Gets all of the symbols that are imports from the operators file.
     * @param sourceFile 
     * @returns 
     */
    private _getImportsOfOperatorSymbols(sourceFile: ts.SourceFile): ts.Symbol[] {
        const importSymbols: ts.Symbol[] = [];
        const importDeclarations = sourceFile.statements.filter(ts.isImportDeclaration);

        importDeclarations.forEach(importDeclaration => {
            const importClause = importDeclaration.importClause;
            if(!importClause) {
                return;
            }

            // Named imports (import { ADD } from './module';)
            if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
                importClause.namedBindings.elements.forEach(importSpecifier => {
                    const symbol = this._checker.getSymbolAtLocation(importSpecifier.name);
                    if (symbol) {
                        importSymbols.push(symbol);
                    }
                });
            }

            // Namespace imports (import * as ModuleName from './module';)
            else if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
                const symbol = this._checker.getSymbolAtLocation(importClause.namedBindings.name);
                if (symbol) {
                    importSymbols.push(symbol);
                }
            }

            // Default imports (import DefaultName from './module';)
            if (importClause.name) {
                const symbol = this._checker.getSymbolAtLocation(importClause.name);
                if (symbol) {
                    importSymbols.push(symbol);
                }
            }
        });

        return importSymbols;
    }

    /**
     * Finds any overloads declared in the given file.
     * @param file 
     */
    public loadOverloadsFromFile(file: ts.SourceFile): void {
        const imports = this._getImportsOfOperatorSymbols(file);
        this._loadOverloadsFromNode(file, imports);
    }

    /**
     * For a given symbol, check if it matches one of the symbols imported from our operators file,
     * then double check whether that symbol aliases one of the original symbols in the operators file.
     * @param symbol 
     * @param imports 
     */
    private _findMatchingOperatorSymbol(symbol: ts.Symbol, imports: ts.ImportDeclaration[]): OperatorName | undefined {
        const matchingImport = imports.find((i) => {
            const symbol = this._checker.getSymbolAtLocation(i);
            return symbol === symbol;
        });

        if (!matchingImport) {
            return;
        }

        const aliasedSymbol = this._checker.getAliasedSymbol(symbol);
        if(!Object.values(this._symbols).includes(aliasedSymbol))
        {
            return;
        }

        console.log("HERE!");
        return aliasedSymbol.name as OperatorName;
    }

    private _loadOverloadsFromNode(node: ts.Node, imports: ts.ImportDeclaration[]): void {
        if (isStaticPropertyDeclaration(node)) {
            const propertyName = node.name
            if (ts.isIdentifier(propertyName)) {
                const propertySymbol = this._checker.getSymbolAtLocation(propertyName);
                if(!propertySymbol) {
                    return;
                }
                const operatorName = this._findMatchingOperatorSymbol(propertySymbol, imports);
                console.log(operatorName);
            }
        }
        // if(
        //     ts.isIdentifier(node)
        //     // && isStaticPropertyDeclaration(node.parent)
        // ) {
        //     const symbol = this._checker.getSymbolAtLocation(node);
        //     if(symbol && symbol.flags & ts.SymbolFlags.Alias) {
        //         const aliased = this._checker.getAliasedSymbol(symbol);
        //         if(Object.values(this._symbols).includes(aliased)){
        //             console.log("FOUND!")
        //             console.log(node.parent.parent.parent.parent.getText());
        //         }
        //     }
        // }

        node.forEachChild((child) => this._loadOverloadsFromNode(child, imports));
    }


}
