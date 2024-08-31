import type ts from "typescript";
import type { PrimitiveType } from "./PrimitiveType";

export class OperatorOverload
{
	constructor(
		private _checker: ts.TypeChecker,
		private _name: string,
		private _left: ts.Type | PrimitiveType,
		private _right: ts.Type | PrimitiveType,
		private _func: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
		private _operatorSymbol: ts.Symbol,
		private _overloadPropertyName: ts.Symbol,
		private _classType: ts.Type
	)
	{ }

	toString(): string
	{
		return `\n\x1b[1m${this._checker.typeToString(this._classType)}: ${this._name}\x1b[0m\n`
			// Fix in prefs! https://eslint.style/rules/plus/indent-binary-ops
			// eslint-disable-next-line @stylistic/indent-binary-ops
			+ `Left: ${typeof this._left === "string" ? `${this._left} (primitive)` : `${this._left.getSymbol()?.getName()} (complex type)`}\n`
			+ `Right: ${typeof this._right === "string" ? `${this._right} (primitive)` : `${this._right.getSymbol()?.getName()} (complex type)`}\n`
			+ `Func: ${this._func.getText().split("\n")[0]}\n`
			+ `Operator: ${this._operatorSymbol.getName()}\n`
			+ `Property name: ${this._checker.symbolToString(this._overloadPropertyName)}`;
	}
}
