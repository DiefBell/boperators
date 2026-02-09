// Core transformation pipeline

export { ErrorDescription, ErrorManager } from "./core/ErrorManager";
export { getOperatorStringFromProperty } from "./core/helpers/getOperatorStringFromProperty";
export { resolveExpressionType } from "./core/helpers/resolveExpressionType";
export { unwrapInitializer } from "./core/helpers/unwrapInitializer";
export type { TransformResult } from "./core/OverloadInjector";
export { OverloadInjector } from "./core/OverloadInjector";
export type { OverloadDescription } from "./core/OverloadStore";
export { OverloadStore } from "./core/OverloadStore";
export { isOperatorSyntaxKind } from "./core/operatorMap";
export type { EditRecord } from "./core/SourceMap";
export { SourceMap } from "./core/SourceMap";

// Operator definitions

export { Operator, operatorSymbols } from "./lib/operatorSymbols";
