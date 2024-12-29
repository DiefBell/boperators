import * as path from "path";
import { Project, type SyntaxKind, type VariableDeclaration } from "ts-morph";
import { LIB_ROOT, OPERATOR_SYMBOLS_FILE } from "./consts";
import { operatorMap, type OperatorName } from "./operatorMap";

const testFilePath = path.join(process.cwd(), "test", "test.ts");

const project = new Project();
project.addSourceFilesAtPaths([OPERATOR_SYMBOLS_FILE, LIB_ROOT, testFilePath]);

const operatorSymbolsFile = project.getSourceFile(OPERATOR_SYMBOLS_FILE);
const operatorSymbols = new Map<VariableDeclaration, SyntaxKind>(
	operatorSymbolsFile!
		.getVariableDeclarations()
		.filter((decl) => decl.getInitializer()?.getText().startsWith("Symbol"))
		.map((decl) => [decl, operatorMap[decl.getName() as OperatorName]])
);
