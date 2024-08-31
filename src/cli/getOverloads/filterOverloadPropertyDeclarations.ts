import ts from "typescript";

export type PropertyOperatorSymbolPair = {
	// https://eslint.style/rules/ts/member-delimiter-style
	// eslint-disable-next-line
	declaration: ts.PropertyDeclaration;
	operatorSymbol: ts.Symbol
};

/**
 * Filters out any propDeclarationSymbols that aren't in importSymbols.
 * Then filters out again if those import symbols don't alias to something in operatorSymbols.
 * Must work with both NamedImports and NamespaceImports.
 *
 * @param propDeclarations - Symbols for property declarations with computed names.
 * @param importSymbols - Symbols imported into the current file, both named and namespace imports.
 * @param operatorSymbols - Symbols from the original operator file to validate against.
 * @returns An array of symbols that are valid operator symbols.
 */
export const filterOperatorOverloadDeclarations = (
	checker: ts.TypeChecker,
	propDeclarations: ts.PropertyDeclaration[],
	importSymbols: ts.Symbol[],
	operatorSymbols: ts.Symbol[]
): PropertyOperatorSymbolPair[] =>
{
	const validDeclarations: PropertyOperatorSymbolPair[] = [];

	propDeclarations.forEach((declaration) =>
	{
		// Get the computed property name expression (e.g., `ops.MULTIPLY`)
		const name = declaration.name;
		if (!ts.isComputedPropertyName(name))
		{
			return; // Ensure it is actually a computed property name
		}

		const expression = name.expression;
		let symbol: ts.Symbol | null;
		if (ts.isPropertyAccessExpression(expression))
		{
			symbol = getPropertyAccessExpressionOperatorSymbol(checker, expression, importSymbols, operatorSymbols);
		}
		else
		{
			symbol = getPropertyNameOperatorSymbol(checker, expression, operatorSymbols);
		}

		// https://eslint.style/rules/ts/keyword-spacing
		// eslint-disable-next-line
		if (!!symbol) {
			validDeclarations.push({ declaration: declaration, operatorSymbol: symbol });
		}
	});

	return validDeclarations;
};

/**
	 * If the computed property name is a PropertyAccessExpression
	 * i.e., `ops.MULTIPLY`, we check whether it is for one of our operatorSymbols,
	 * and return the operator symbol if it is.
	 * @param expression The property access expression, e.g., `ops.DIVIDE`.
	 * @param importSymbols The symbols imported into the current file.
	 * @param operatorSymbols The symbols representing the valid operator symbols.
	 * @returns Whether the given expression corresponds to a valid operator symbol.
	 */
const getPropertyAccessExpressionOperatorSymbol = (
	checker: ts.TypeChecker,
	expression: ts.PropertyAccessExpression,
	importSymbols: ts.Symbol[],
	operatorSymbols: ts.Symbol[]
): ts.Symbol | null =>
{
	// Get the symbol for the left-hand side (namespace or module)
	let leftSymbol = checker.getSymbolAtLocation(expression.expression);
	if (!leftSymbol)
	{
		console.error("Could not resolve symbol for left side of property access");
		return null;
	}

	// Check if the left symbol is in the import symbols (i.e., it should be an imported namespace/module)
	if (!importSymbols.includes(leftSymbol))
	{
		console.error(`Symbol "${leftSymbol.getName()}" is not an import in its file`);
		return null;
	}

	const leftSymbolAlias = !!(leftSymbol.flags & ts.SymbolFlags.Alias)
		? checker.getAliasedSymbol(leftSymbol)
		: undefined;

	if (
		!leftSymbolAlias
		|| (leftSymbolAlias.flags & ts.SymbolFlags.Namespace) === 0
		|| (leftSymbolAlias.flags & ts.SymbolFlags.Module) === 0
	)
	{
		console.error(
			`Symbol "${leftSymbol.getName()}" doesn't alias anything. Are you sure it's an import?`
		);
		return null;
	}

	// At this point, `leftSymbol` is expected to be the namespace/module symbol itself.
	// Fetch the symbol that represents the module or namespace exports.
	const exportedSymbols = checker.getExportsOfModule(leftSymbolAlias);

	// If the exported symbols cannot be resolved, return false
	if (!exportedSymbols)
	{
		console.error(`Could not retrieve exports from module "${leftSymbol.getName()}"`);
		return null;
	}

	// Get the right-hand side name of the property access (e.g., `MULTIPLY`)
	const rightName = expression.name.text;

	// Find the right-hand symbol in the module's exports
	const rightSymbol = exportedSymbols.find(sym => sym.name === rightName);
	if (!rightSymbol)
	{
		console.error(`Symbol "${rightName}" is not an exported member of "${leftSymbol.getName()}"`);
		return null;
	}

	const isOperatorSymbol = operatorSymbols.includes(rightSymbol);
	return isOperatorSymbol ? rightSymbol : null;
};

/**
	 * If a computed property name is not a PropertyAccessExpression
	 * i.e. it's just `SUBTRACT`, we check whether it is one of our operatorSymbols.
	 * If it is then return the symbol.
	 * @param expression The property symbol e.g. "ADD"
	 * @param importSymbols The symbols imported into the current file.
	 * @param operatorSymbols The symbols representing the valid operator symbols.
	 * @returnsWhether the given expression corresponds to a valid operator symbol.
	 */
const getPropertyNameOperatorSymbol = (
	checker: ts.TypeChecker,
	expression: ts.Expression,
	operatorSymbols: ts.Symbol[]
)
// https://eslint.style/rules/ts/type-annotation-spacing
// Is it even possible to allow newlines but not spaces?
// eslint-disable-next-line
	: ts.Symbol | null => {
	// Handle other types of expressions (direct computed names) if needed
	const symbol = checker.getSymbolAtLocation(expression);

	if (!symbol || !(symbol.flags & ts.SymbolFlags.Alias))
	{
		return null;
	}

	if (!symbol)
	{
		return null;
	}

	const aliasedSymbol = checker.getAliasedSymbol(symbol);

	return operatorSymbols.includes(aliasedSymbol) ? aliasedSymbol : null;
};
