// Core transformation pipeline

export type {
	BopConfFile,
	BopConfig,
	BopLogger,
	LoadConfigOptions,
	LogLevel,
} from "./core/BopConfig";
export { ConsoleLogger, loadConfig } from "./core/BopConfig";
export { ErrorDescription, ErrorManager } from "./core/ErrorManager";
export { getOperatorStringFromProperty } from "./core/helpers/getOperatorStringFromProperty";
export { resolveExpressionType } from "./core/helpers/resolveExpressionType";
export { unwrapInitializer } from "./core/helpers/unwrapInitializer";
export type { TransformResult } from "./core/OverloadInjector";
export { OverloadInjector } from "./core/OverloadInjector";
export type { OverloadDescription } from "./core/OverloadStore";
export { OverloadStore } from "./core/OverloadStore";
export type {
	PostfixUnaryOperatorSyntaxKind,
	PrefixUnaryOperatorSyntaxKind,
} from "./core/operatorMap";
export {
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
} from "./core/operatorMap";
export type { EditRecord } from "./core/SourceMap";
export { SourceMap } from "./core/SourceMap";

// Operator definitions

export { Operator, operatorSymbols } from "./lib/operatorSymbols";

// Re-export ts-morph types used by plugins and CLI

export type { SourceFile } from "ts-morph";
export { Node, Project, SyntaxKind } from "ts-morph";
