import {
	type BopLogger,
	ErrorManager,
	getOperatorStringFromProperty,
	isOperatorSyntaxKind,
	isPostfixUnaryOperatorSyntaxKind,
	isPrefixUnaryOperatorSyntaxKind,
	loadConfig,
	Node,
	OverloadInjector,
	OverloadStore,
	resolveExpressionType,
	SyntaxKind,
	Project as TsMorphProject,
	type SourceFile as TsMorphSourceFile,
	unwrapInitializer,
} from "boperators";
import type tsRuntime from "typescript/lib/tsserverlibrary";
import { SourceMap } from "./SourceMap";

// ----- Types -----

type CacheEntry = {
	version: string;
	text: string;
	sourceMap: SourceMap;
	overloadEdits: OverloadEditInfo[];
};

type OverloadEditInfo = {
	/** Start of the operator token in the original source */
	operatorStart: number;
	/** End of the operator token in the original source */
	operatorEnd: number;
	/** Start of the hover hit-test area (includes surrounding whitespace) */
	hoverStart: number;
	/** End of the hover hit-test area (includes surrounding whitespace) */
	hoverEnd: number;
	/** Start of the full expression in the original source */
	exprStart: number;
	/** End of the full expression in the original source */
	exprEnd: number;
	className: string;
	classFilePath: string;
	operatorString: string;
	index: number;
	isStatic: boolean;
	kind: "binary" | "prefixUnary" | "postfixUnary";
};

// ----- Plugin entry -----

export = function init(modules: {
	typescript: typeof tsRuntime;
}): tsRuntime.server.PluginModule {
	const ts = modules.typescript;

	function create(
		info: tsRuntime.server.PluginCreateInfo,
	): tsRuntime.LanguageService {
		const tsServerLogger: BopLogger = {
			debug: (msg) =>
				info.project.projectService.logger.info(`[boperators] [debug] ${msg}`),
			info: (msg) =>
				info.project.projectService.logger.info(`[boperators] ${msg}`),
			warn: (msg) =>
				info.project.projectService.logger.info(`[boperators] [warn] ${msg}`),
			error: (msg) =>
				info.project.projectService.logger.info(`[boperators] [error] ${msg}`),
		};
		const config = loadConfig({ logger: tsServerLogger });
		config.logger.info(
			`Creating language service plugin for project: ${info.project.getProjectName()}`,
		);
		const host = info.languageServiceHost;

		// Set up ts-morph transformation pipeline
		const project = new TsMorphProject({ skipFileDependencyResolution: true });
		const errorManager = new ErrorManager(config);
		const overloadStore = new OverloadStore(
			project,
			errorManager,
			config.logger,
		);
		const overloadInjector = new OverloadInjector(
			project,
			overloadStore,
			config.logger,
		);

		const originalGetSnapshot = host.getScriptSnapshot?.bind(host);
		const originalGetVersion = host.getScriptVersion?.bind(host);
		const cache = new Map<string, CacheEntry>();

		host.getScriptSnapshot = (fileName: string) => {
			const snap = originalGetSnapshot?.(fileName);
			if (!snap || !fileName.endsWith(".ts") || fileName.endsWith(".d.ts"))
				return snap;

			const version = originalGetVersion?.(fileName) ?? "0";
			const cached = cache.get(fileName);
			if (cached?.version === version) {
				return ts.ScriptSnapshot.fromString(cached.text);
			}

			const source = snap.getText(0, snap.getLength());

			try {
				// Invalidate this file's old overload entries before overwriting.
				const hadOverloads = overloadStore.invalidateFile(fileName);
				if (hadOverloads) cache.clear();

				// Add/update the file in our ts-morph project
				project.createSourceFile(fileName, source, { overwrite: true });

				// Resolve any new dependencies and scan for overloads.
				const deps = project.resolveSourceFileDependencies();
				for (const dep of deps) overloadStore.addOverloadsFromFile(dep);
				overloadStore.addOverloadsFromFile(fileName);
				errorManager.throwIfErrorsElseLogWarnings();

				// Before transforming, scan for overloaded expressions
				// so we can record their operator positions for hover info.
				const sourceFile = project.getSourceFileOrThrow(fileName);
				const overloadEdits = findOverloadEdits(sourceFile, overloadStore);

				// Transform expressions (returns text + source map)
				const result = overloadInjector.overloadFile(fileName);

				cache.set(fileName, {
					version,
					text: result.text,
					sourceMap: new SourceMap(result.edits),
					overloadEdits,
				});
				return ts.ScriptSnapshot.fromString(result.text);
			} catch (e) {
				config.logger.error(`Error transforming ${fileName}: ${e}`);
				cache.set(fileName, {
					version,
					text: source,
					sourceMap: new SourceMap([]),
					overloadEdits: [],
				});
				return snap;
			}
		};

		// Create the language service proxy with position remapping
		const proxy = createProxy(ts, info.languageService, cache, project);

		config.logger.info("Plugin loaded");
		return proxy;
	}

	return { create };
};

// ----- Overload edit scanner -----

/**
 * Before transformation, find all expressions (binary, prefix unary, postfix unary)
 * that match registered overloads and record their operator token positions.
 * This is used to provide hover info for overloaded operators.
 */
/**
 * Recursively resolve the effective type of an expression, accounting for
 * operator overloads. For sub-expressions that match a registered overload,
 * uses the overload's declared return type instead of what TypeScript infers
 * (since TS doesn't know about operator overloading).
 */
function resolveOverloadedType(
	node: Node,
	overloadStore: OverloadStore,
): string {
	if (Node.isParenthesizedExpression(node)) {
		return resolveOverloadedType(node.getExpression(), overloadStore);
	}

	if (Node.isBinaryExpression(node)) {
		const operatorKind = node.getOperatorToken().getKind();
		if (isOperatorSyntaxKind(operatorKind)) {
			const leftType = resolveOverloadedType(node.getLeft(), overloadStore);
			const rightType = resolveOverloadedType(node.getRight(), overloadStore);
			const overload = overloadStore.findOverload(
				operatorKind,
				leftType,
				rightType,
			);
			if (overload) return overload.returnType;
		}
	}

	if (Node.isPrefixUnaryExpression(node)) {
		const operatorKind = node.getOperatorToken();
		if (isPrefixUnaryOperatorSyntaxKind(operatorKind)) {
			const operandType = resolveOverloadedType(
				node.getOperand(),
				overloadStore,
			);
			const overload = overloadStore.findPrefixUnaryOverload(
				operatorKind,
				operandType,
			);
			if (overload) return overload.returnType;
		}
	}

	if (Node.isPostfixUnaryExpression(node)) {
		const operatorKind = node.getOperatorToken();
		if (isPostfixUnaryOperatorSyntaxKind(operatorKind)) {
			const operandType = resolveOverloadedType(
				node.getOperand(),
				overloadStore,
			);
			const overload = overloadStore.findPostfixUnaryOverload(
				operatorKind,
				operandType,
			);
			if (overload) return overload.returnType;
		}
	}

	return resolveExpressionType(node);
}

function findOverloadEdits(
	sourceFile: TsMorphSourceFile,
	overloadStore: OverloadStore,
): OverloadEditInfo[] {
	const edits: OverloadEditInfo[] = [];
	const binaryExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.BinaryExpression,
	);

	for (const expression of binaryExpressions) {
		const operatorToken = expression.getOperatorToken();
		const operatorKind = operatorToken.getKind();

		if (!isOperatorSyntaxKind(operatorKind)) continue;

		const leftType = resolveOverloadedType(expression.getLeft(), overloadStore);
		const rightType = resolveOverloadedType(
			expression.getRight(),
			overloadStore,
		);

		const overloadDesc = overloadStore.findOverload(
			operatorKind,
			leftType,
			rightType,
		);
		if (!overloadDesc) continue;

		edits.push({
			operatorStart: operatorToken.getStart(),
			operatorEnd: operatorToken.getEnd(),
			hoverStart: expression.getLeft().getEnd(),
			hoverEnd: expression.getRight().getStart(),
			exprStart: expression.getStart(),
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			index: overloadDesc.index,
			isStatic: overloadDesc.isStatic,
			kind: "binary",
		});
	}

	// Scan prefix unary expressions
	const prefixExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.PrefixUnaryExpression,
	);
	for (const expression of prefixExpressions) {
		const operatorKind = expression.getOperatorToken();
		if (!isPrefixUnaryOperatorSyntaxKind(operatorKind)) continue;

		const operandType = resolveOverloadedType(
			expression.getOperand(),
			overloadStore,
		);
		const overloadDesc = overloadStore.findPrefixUnaryOverload(
			operatorKind,
			operandType,
		);
		if (!overloadDesc) continue;

		const exprStart = expression.getStart();
		const operand = expression.getOperand();

		edits.push({
			operatorStart: exprStart,
			operatorEnd: operand.getStart(),
			hoverStart: exprStart,
			hoverEnd: operand.getStart(),
			exprStart,
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			index: overloadDesc.index,
			isStatic: overloadDesc.isStatic,
			kind: "prefixUnary",
		});
	}

	// Scan postfix unary expressions
	const postfixExpressions = sourceFile.getDescendantsOfKind(
		SyntaxKind.PostfixUnaryExpression,
	);
	for (const expression of postfixExpressions) {
		const operatorKind = expression.getOperatorToken();
		if (!isPostfixUnaryOperatorSyntaxKind(operatorKind)) continue;

		const operandType = resolveOverloadedType(
			expression.getOperand(),
			overloadStore,
		);
		const overloadDesc = overloadStore.findPostfixUnaryOverload(
			operatorKind,
			operandType,
		);
		if (!overloadDesc) continue;

		const operand = expression.getOperand();
		const operatorStart = operand.getEnd();

		edits.push({
			operatorStart,
			operatorEnd: expression.getEnd(),
			hoverStart: operatorStart,
			hoverEnd: expression.getEnd(),
			exprStart: expression.getStart(),
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			index: overloadDesc.index,
			isStatic: overloadDesc.isStatic,
			kind: "postfixUnary",
		});
	}

	return edits;
}

// ----- Overload hover info -----

/**
 * Build a QuickInfo response for hovering over an operator token
 * that corresponds to an overloaded operator. Extracts the function
 * signature and JSDoc from the overload definition.
 */
function getOverloadHoverInfo(
	ts: typeof tsRuntime,
	project: TsMorphProject,
	edit: OverloadEditInfo,
): tsRuntime.QuickInfo | undefined {
	try {
		const classSourceFile = project.getSourceFile(edit.classFilePath);
		if (!classSourceFile) return undefined;

		const classDecl = classSourceFile.getClass(edit.className);
		if (!classDecl) return undefined;

		// Find the property with the matching operator string
		const prop = classDecl.getProperties().find((p) => {
			if (!Node.isPropertyDeclaration(p)) return false;
			return getOperatorStringFromProperty(p) === edit.operatorString;
		});
		if (!prop || !Node.isPropertyDeclaration(prop)) return undefined;

		// Extract param types and return type from either the initializer (regular
		// .ts files) or the type annotation (.d.ts files where initializers are
		// stripped by TypeScript's declaration emit).
		let params: { typeName: string }[] = [];
		let returnTypeName: string;
		let docText: string | undefined;

		const initializer = unwrapInitializer(prop.getInitializer());
		if (initializer && Node.isArrayLiteralExpression(initializer)) {
			const element = initializer.getElements()[edit.index];
			if (
				!element ||
				(!Node.isFunctionExpression(element) && !Node.isArrowFunction(element))
			)
				return undefined;

			const nonThisParams = element
				.getParameters()
				.filter((p) => p.getName() !== "this");
			params = nonThisParams.map((p) => ({
				typeName: p.getType().getText(element),
			}));
			returnTypeName = element.getReturnType().getText(element);

			const jsDocs = element.getJsDocs();
			if (jsDocs.length > 0) {
				const raw = jsDocs[0].getText();
				docText = raw
					.replace(/^\/\*\*\s*/, "")
					.replace(/\s*\*\/$/, "")
					.replace(/^\s*\* ?/gm, "")
					.trim();
			}
		} else {
			// Type-annotation fallback for .d.ts files
			const propertyType = prop.getType();
			if (!propertyType.isTuple()) return undefined;
			const tupleElements = propertyType.getTupleElements();
			if (edit.index >= tupleElements.length) return undefined;

			const elementType = tupleElements[edit.index];
			const callSigs = elementType.getCallSignatures();
			if (callSigs.length === 0) return undefined;
			const sig = callSigs[0];

			for (const sym of sig.getParameters()) {
				if (sym.getName() === "this") continue;
				const decl = sym.getValueDeclaration();
				if (!decl) continue;
				params.push({ typeName: decl.getType().getText(prop) });
			}
			returnTypeName = sig.getReturnType().getText(prop);
		}

		// Build display signature parts based on overload kind
		const displayParts: tsRuntime.SymbolDisplayPart[] = [];

		if (edit.kind === "prefixUnary") {
			// Prefix unary: "-Vector3 = Vector3"
			displayParts.push({
				text: edit.operatorString,
				kind: "operator",
			});
			const operandType =
				params.length >= 1 ? params[0].typeName : edit.className;
			displayParts.push({ text: operandType, kind: "className" });
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({
					text: returnTypeName,
					kind: "className",
				});
			}
		} else if (edit.kind === "postfixUnary") {
			// Postfix unary: "Vector3++"
			displayParts.push({ text: edit.className, kind: "className" });
			displayParts.push({
				text: edit.operatorString,
				kind: "operator",
			});
		} else if (edit.isStatic && params.length >= 2) {
			// Binary static: "LhsType + RhsType = ReturnType"
			const lhsType = params[0].typeName;
			const rhsType = params[1].typeName;
			displayParts.push({ text: lhsType, kind: "className" });
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({
				text: edit.operatorString,
				kind: "operator",
			});
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({ text: rhsType, kind: "className" });
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({
					text: returnTypeName,
					kind: "className",
				});
			}
		} else {
			// Binary instance: "ClassName += RhsType"
			const rhsType = params.length >= 1 ? params[0].typeName : "unknown";
			displayParts.push({ text: edit.className, kind: "className" });
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({
				text: edit.operatorString,
				kind: "operator",
			});
			displayParts.push({ text: " ", kind: "space" });
			displayParts.push({ text: rhsType, kind: "className" });
			if (returnTypeName !== "void") {
				displayParts.push({ text: " = ", kind: "punctuation" });
				displayParts.push({
					text: returnTypeName,
					kind: "className",
				});
			}
		}

		return {
			kind: ts.ScriptElementKind.functionElement,
			kindModifiers: edit.isStatic ? "static" : "",
			textSpan: {
				start: edit.operatorStart,
				length: edit.operatorEnd - edit.operatorStart,
			},
			displayParts,
			documentation: docText ? [{ text: docText, kind: "text" }] : undefined,
			tags: [],
		};
	} catch {
		return undefined;
	}
}

// ----- LanguageService proxy -----

function getSourceMapForFile(
	cache: Map<string, CacheEntry>,
	fileName: string,
): SourceMap | undefined {
	const entry = cache.get(fileName);
	if (!entry || entry.sourceMap.isEmpty) return undefined;
	return entry.sourceMap;
}

function remapDiagnosticSpan(
	diag: { start?: number; length?: number },
	sourceMap: SourceMap,
): void {
	if (diag.start !== undefined && diag.length !== undefined) {
		const remapped = sourceMap.remapSpan({
			start: diag.start,
			length: diag.length,
		});
		diag.start = remapped.start;
		diag.length = remapped.length;
	}
}

function createProxy(
	ts: typeof tsRuntime,
	ls: tsRuntime.LanguageService,
	cache: Map<string, CacheEntry>,
	project: TsMorphProject,
): tsRuntime.LanguageService {
	// Copy all methods from the underlying language service
	const proxy = Object.create(null) as tsRuntime.LanguageService;
	for (const key of Object.keys(ls)) {
		// biome-ignore lint/suspicious/noExplicitAny: <TODO: fix this>
		(proxy as any)[key] = (ls as any)[key];
	}

	// --- Diagnostics: remap output spans + suppress overload errors ---

	const isOverloadSuppressed = (
		code: number,
		start: number | undefined,
		entry: CacheEntry | undefined,
	): boolean => {
		if (!entry?.overloadEdits.length || start === undefined) return false;
		// TS2588: "Cannot assign to 'x' because it is a constant."
		if (code === 2588) {
			return entry.overloadEdits.some(
				(e) => !e.isStatic && start >= e.exprStart && start < e.exprEnd,
			);
		}
		return false;
	};

	proxy.getSemanticDiagnostics = (fileName) => {
		const result = ls.getSemanticDiagnostics(fileName);
		const entry = cache.get(fileName);
		const sourceMap =
			entry?.sourceMap.isEmpty === false ? entry.sourceMap : undefined;

		if (sourceMap) {
			for (const diag of result) {
				remapDiagnosticSpan(diag, sourceMap);
				if (diag.relatedInformation) {
					for (const related of diag.relatedInformation) {
						const relatedMap = related.file
							? getSourceMapForFile(cache, related.file.fileName)
							: undefined;
						if (relatedMap) remapDiagnosticSpan(related, relatedMap);
					}
				}
			}
		}

		return result.filter(
			(diag) => !isOverloadSuppressed(diag.code, diag.start, entry),
		);
	};

	proxy.getSyntacticDiagnostics = (fileName) => {
		const result = ls.getSyntacticDiagnostics(fileName);
		const entry = cache.get(fileName);
		const sourceMap =
			entry?.sourceMap.isEmpty === false ? entry.sourceMap : undefined;

		if (sourceMap) {
			for (const diag of result) {
				remapDiagnosticSpan(diag, sourceMap);
				if (diag.relatedInformation) {
					for (const related of diag.relatedInformation) {
						const relatedMap = related.file
							? getSourceMapForFile(cache, related.file.fileName)
							: undefined;
						if (relatedMap) remapDiagnosticSpan(related, relatedMap);
					}
				}
			}
		}

		return result.filter(
			(diag) => !isOverloadSuppressed(diag.code, diag.start, entry),
		);
	};

	proxy.getSuggestionDiagnostics = (fileName) => {
		const result = ls.getSuggestionDiagnostics(fileName);
		const sourceMap = getSourceMapForFile(cache, fileName);
		if (!sourceMap) return result;

		for (const diag of result) {
			remapDiagnosticSpan(diag, sourceMap);
		}
		return result;
	};

	// --- Hover: remap input position + output span, custom operator hover ---

	proxy.getQuickInfoAtPosition = (fileName, position) => {
		// Check if hovering over an overloaded operator
		const entry = cache.get(fileName);
		if (entry) {
			const operatorEdit = entry.overloadEdits.find(
				(e) => position >= e.hoverStart && position < e.hoverEnd,
			);
			if (operatorEdit) {
				const hoverInfo = getOverloadHoverInfo(ts, project, operatorEdit);
				if (hoverInfo) return hoverInfo;
			}
		}

		const sourceMap =
			entry?.sourceMap.isEmpty === false ? entry.sourceMap : undefined;
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getQuickInfoAtPosition(fileName, transformedPos);
		if (!result || !sourceMap) return result;

		result.textSpan = sourceMap.remapSpan(result.textSpan);
		return result;
	};

	// --- Go-to-definition: remap input position + output spans ---

	proxy.getDefinitionAndBoundSpan = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getDefinitionAndBoundSpan(fileName, transformedPos);
		if (!result) return result;

		// Remap the bound span (in the current file)
		if (sourceMap) {
			result.textSpan = sourceMap.remapSpan(result.textSpan);
		}

		// Remap definition spans (may be in other files)
		if (result.definitions) {
			for (const def of result.definitions) {
				const defMap = getSourceMapForFile(cache, def.fileName);
				if (defMap) {
					def.textSpan = defMap.remapSpan(def.textSpan);
					if (def.contextSpan) {
						def.contextSpan = defMap.remapSpan(def.contextSpan);
					}
				}
			}
		}

		return result;
	};

	proxy.getDefinitionAtPosition = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getDefinitionAtPosition(fileName, transformedPos);
		if (!result) return result;

		return result.map((def) => {
			const defMap = getSourceMapForFile(cache, def.fileName);
			if (!defMap) return def;
			return {
				...def,
				textSpan: defMap.remapSpan(def.textSpan),
				contextSpan: def.contextSpan
					? defMap.remapSpan(def.contextSpan)
					: undefined,
			};
		});
	};

	proxy.getTypeDefinitionAtPosition = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getTypeDefinitionAtPosition(fileName, transformedPos);
		if (!result) return result;

		return result.map((def) => {
			const defMap = getSourceMapForFile(cache, def.fileName);
			if (!defMap) return def;
			return {
				...def,
				textSpan: defMap.remapSpan(def.textSpan),
				contextSpan: def.contextSpan
					? defMap.remapSpan(def.contextSpan)
					: undefined,
			};
		});
	};

	// --- Completions: remap input position ---

	proxy.getCompletionsAtPosition = (
		fileName,
		position,
		options,
		formattingSettings,
	) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getCompletionsAtPosition(
			fileName,
			transformedPos,
			options,
			formattingSettings,
		);
		if (!result || !sourceMap) return result;

		// Remap replacement spans in completion entries
		if (result.optionalReplacementSpan) {
			result.optionalReplacementSpan = sourceMap.remapSpan(
				result.optionalReplacementSpan,
			);
		}
		for (const entry of result.entries) {
			if (entry.replacementSpan) {
				entry.replacementSpan = sourceMap.remapSpan(entry.replacementSpan);
			}
		}

		return result;
	};

	// --- References: remap input + output ---

	proxy.getReferencesAtPosition = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getReferencesAtPosition(fileName, transformedPos);
		if (!result) return result;

		return result.map((ref) => {
			const refMap = getSourceMapForFile(cache, ref.fileName);
			if (!refMap) return ref;
			return {
				...ref,
				textSpan: refMap.remapSpan(ref.textSpan),
				contextSpan: ref.contextSpan
					? refMap.remapSpan(ref.contextSpan)
					: undefined,
			};
		});
	};

	proxy.findReferences = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.findReferences(fileName, transformedPos);
		if (!result) return result;

		return result.map((group) => ({
			...group,
			references: group.references.map((ref) => {
				const refMap = getSourceMapForFile(cache, ref.fileName);
				if (!refMap) return ref;
				return {
					...ref,
					textSpan: refMap.remapSpan(ref.textSpan),
					contextSpan: ref.contextSpan
						? refMap.remapSpan(ref.contextSpan)
						: undefined,
				};
			}),
		}));
	};

	// --- Classifications: remap output spans for syntax coloring ---

	proxy.getEncodedSemanticClassifications = (fileName, span, format) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedSpan = sourceMap
			? {
					start: sourceMap.originalToTransformed(span.start),
					length:
						sourceMap.originalToTransformed(span.start + span.length) -
						sourceMap.originalToTransformed(span.start),
				}
			: span;

		const result = ls.getEncodedSemanticClassifications(
			fileName,
			transformedSpan,
			format,
		);
		if (!sourceMap) return result;

		// spans are triples: [start, length, classification, ...]
		for (let i = 0; i < result.spans.length; i += 3) {
			const remapped = sourceMap.remapSpan({
				start: result.spans[i],
				length: result.spans[i + 1],
			});
			result.spans[i] = remapped.start;
			result.spans[i + 1] = remapped.length;
		}
		return result;
	};

	proxy.getEncodedSyntacticClassifications = (fileName, span) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedSpan = sourceMap
			? {
					start: sourceMap.originalToTransformed(span.start),
					length:
						sourceMap.originalToTransformed(span.start + span.length) -
						sourceMap.originalToTransformed(span.start),
				}
			: span;

		const result = ls.getEncodedSyntacticClassifications(
			fileName,
			transformedSpan,
		);
		if (!sourceMap) return result;

		for (let i = 0; i < result.spans.length; i += 3) {
			const remapped = sourceMap.remapSpan({
				start: result.spans[i],
				length: result.spans[i + 1],
			});
			result.spans[i] = remapped.start;
			result.spans[i + 1] = remapped.length;
		}
		return result;
	};

	// --- Signature help: remap input position + applicableSpan ---

	proxy.getSignatureHelpItems = (fileName, position, options) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getSignatureHelpItems(fileName, transformedPos, options);
		if (!result || !sourceMap) return result;

		result.applicableSpan = sourceMap.remapSpan(result.applicableSpan);
		return result;
	};

	// --- Rename: remap input + output ---

	proxy.findRenameLocations = (
		fileName,
		position,
		findInStrings,
		findInComments,
		preferences,
	) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		// biome-ignore lint/complexity/noBannedTypes: <TODO: fix this>
		const result = (ls.findRenameLocations as Function)(
			fileName,
			transformedPos,
			findInStrings,
			findInComments,
			preferences,
		) as readonly tsRuntime.RenameLocation[] | undefined;
		if (!result) return result;

		return result.map((loc) => {
			const locMap = getSourceMapForFile(cache, loc.fileName);
			if (!locMap) return loc;
			return {
				...loc,
				textSpan: locMap.remapSpan(loc.textSpan),
				contextSpan: loc.contextSpan
					? locMap.remapSpan(loc.contextSpan)
					: undefined,
			};
		});
	};

	proxy.getRenameInfo = (fileName, position, preferences) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getRenameInfo(fileName, transformedPos, preferences);
		if (!sourceMap) return result;

		if ("triggerSpan" in result && result.triggerSpan) {
			result.triggerSpan = sourceMap.remapSpan(result.triggerSpan);
		}
		return result;
	};

	// --- Implementation location: remap input + output ---

	proxy.getImplementationAtPosition = (fileName, position) => {
		const sourceMap = getSourceMapForFile(cache, fileName);
		const transformedPos = sourceMap
			? sourceMap.originalToTransformed(position)
			: position;

		const result = ls.getImplementationAtPosition(fileName, transformedPos);
		if (!result) return result;

		return result.map((impl) => {
			const implMap = getSourceMapForFile(cache, impl.fileName);
			if (!implMap) return impl;
			return {
				...impl,
				textSpan: implMap.remapSpan(impl.textSpan),
				contextSpan: impl.contextSpan
					? implMap.remapSpan(impl.contextSpan)
					: undefined,
			};
		});
	};

	return proxy;
}
