import type ts from "typescript";
import type { OperatorOverload } from "../types/OperatorOverload";
import { OPERATOR_SYMBOLS_FILE } from "../consts";
import type { WithErrorList } from "../types/WithErrorList";
import { getImportSymbolsInFile } from "./getImportSymbolsInFile";
import { getComputedPropertyDeclarations } from "./getComputedPropertyDeclarations";
import { filterOperatorOverloadDeclarations } from "./filterOverloadPropertyDeclarations";
import { buildOverloads } from "./buildOverloads";

export const getOperatorOverloads = (program: ts.Program, operatorSymbols: ts.Symbol[]): OperatorOverload[] =>
{
	console.log("NUM OPERATOR SYMBOLS", operatorSymbols.length);
	const files = program.getSourceFiles()
		.filter(
			// https://eslint.style/rules/js/arrow-parens
			// eslint-disable-next-line
			(file) => !file.isDeclarationFile && !file.fileName.includes("node_modules") && file.fileName !== OPERATOR_SYMBOLS_FILE
		);

	console.log(`Checking ${files.length} files for overloads...`);

	const overloadsWithErrors = files.map((file) =>
	{
		console.log(`\nChecking file: ${file.fileName}`);
		return getOverloadsInFile(program.getTypeChecker(), operatorSymbols, file);
	});

	const errors = overloadsWithErrors.map(o => o.errorList).join(", ");
	console.log(errors);

	// eslint-disable-next-line @stylistic/arrow-parens
	return overloadsWithErrors.flatMap(o => o.value);
};

const getOverloadsInFile = (
	checker: ts.TypeChecker,
	operatorSymbols: ts.Symbol[],
	file: ts.SourceFile
): WithErrorList<OperatorOverload[]> =>
{
	// 1. get the imports at the top of the file.
	// We can't filter them yet because namespaced imports make life difficult for us.
	const importSymbols = getImportSymbolsInFile(checker, file);
	console.log(`Found ${importSymbols.length} imports in file`);
	if (importSymbols.length === 0)
	{
		return { value: [], errorList: [] };
	}

	// 2. Get any class property declarations in the file that have a computed property name i.e. in square brackets
	const propertyDeclarations = getComputedPropertyDeclarations(file);
	console.log(`Found ${propertyDeclarations.length} computed property declarations`);
	if (propertyDeclarations.length === 0)
	{
		return { value: [], errorList: [] };
	}

	// 3. Filter the declarations where its name is for an operator symbol, also returning the matching operator symbols with them
	const overloadDeclarations = filterOperatorOverloadDeclarations(checker, propertyDeclarations, importSymbols, operatorSymbols);
	console.log(`Found ${overloadDeclarations.length} potential overload declarations`);
	if (overloadDeclarations.length === 0)
	{
		return { value: [], errorList: [] };
	}

	// 4. Filter out invalid declarations, build overloads
	const overloadsWithErrors: WithErrorList<OperatorOverload[]> = buildOverloads(
		checker,
		overloadDeclarations
	);
	console.log(`Found ${overloadsWithErrors.value.length} valid overloads`);
	return overloadsWithErrors;
};
