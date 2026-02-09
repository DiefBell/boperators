import {
	ErrorManager,
	getOperatorStringFromProperty,
	isOperatorSyntaxKind,
	OverloadInjector,
	OverloadStore,
	resolveExpressionType,
	SourceMap,
	unwrapInitializer,
} from "boperators";
import {
	Node,
	SyntaxKind,
	Project as TsMorphProject,
	type SourceFile as TsMorphSourceFile,
} from "ts-morph";
import type tsRuntime from "typescript/lib/tsserverlibrary";

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
	/** Start of the full binary expression in the original source */
	exprStart: number;
	/** End of the full binary expression in the original source */
	exprEnd: number;
	className: string;
	classFilePath: string;
	operatorString: string;
	index: number;
	isStatic: boolean;
};

// ----- Plugin entry -----

export = function init(modules: {
	typescript: typeof tsRuntime;
}): tsRuntime.server.PluginModule {
	const ts = modules.typescript;

	function create(
		info: tsRuntime.server.PluginCreateInfo,
	): tsRuntime.LanguageService {
		const log = (msg: string) =>
			info.project.projectService.logger.info(`[boperators] ${msg}`);
		log(
			`Creating language service plugin for project: ${info.project.getProjectName()}`,
		);
		const host = info.languageServiceHost;

		// Set up ts-morph transformation pipeline
		const project = new TsMorphProject({ skipFileDependencyResolution: true });
		const errorManager = new ErrorManager(false);
		const overloadStore = new OverloadStore(project, errorManager);
		const overloadInjector = new OverloadInjector(project, overloadStore);

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

				// Before transforming, scan for overload binary expressions
				// so we can record their operator positions for hover info.
				const sourceFile = project.getSourceFileOrThrow(fileName);
				const overloadEdits = findOverloadEdits(sourceFile, overloadStore);

				// Transform binary expressions (returns text + source map)
				const result = overloadInjector.overloadFile(fileName);

				cache.set(fileName, {
					version,
					text: result.text,
					sourceMap: result.sourceMap,
					overloadEdits,
				});
				return ts.ScriptSnapshot.fromString(result.text);
			} catch (e) {
				log(`Error transforming ${fileName}: ${e}`);
				cache.set(fileName, {
					version,
					text: source,
					sourceMap: new SourceMap(source, source),
					overloadEdits: [],
				});
				return snap;
			}
		};

		// Create the language service proxy with position remapping
		const proxy = createProxy(ts, info.languageService, cache, project, log);

		log("Plugin loaded");
		return proxy;
	}

	return { create };
};

// ----- Overload edit scanner -----

/**
 * Before transformation, find all binary expressions that match
 * registered overloads and record their operator token positions.
 * This is used to provide hover info for overloaded operators.
 */
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

		const leftType = resolveExpressionType(expression.getLeft());
		const rightType = resolveExpressionType(expression.getRight());

		const overloadDesc = overloadStore.findOverload(
			operatorKind,
			leftType,
			rightType,
		);
		if (!overloadDesc) continue;

		edits.push({
			operatorStart: operatorToken.getStart(),
			operatorEnd: operatorToken.getEnd(),
			exprStart: expression.getStart(),
			exprEnd: expression.getEnd(),
			className: overloadDesc.className,
			classFilePath: overloadDesc.classFilePath,
			operatorString: overloadDesc.operatorString,
			index: overloadDesc.index,
			isStatic: overloadDesc.isStatic,
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

		const initializer = unwrapInitializer(prop.getInitializer());
		if (!initializer || !Node.isArrayLiteralExpression(initializer))
			return undefined;

		const element = initializer.getElements()[edit.index];
		if (
			!element ||
			(!Node.isFunctionExpression(element) && !Node.isArrowFunction(element))
		)
			return undefined;

		// Build signature string
		const params = element
			.getParameters()
			.filter((p) => p.getName() !== "this")
			.map((p) => `${p.getName()}: ${p.getType().getText()}`);
		const returnType = element.getReturnType().getText();

		const prefix = edit.isStatic
			? "(static operator overload) "
			: "(operator overload) ";
		const signature = `${edit.className}["${edit.operatorString}"](${params.join(", ")}): ${returnType}`;

		// Extract JSDoc comment
		const jsDocs = element.getJsDocs();
		let docText: string | undefined;
		if (jsDocs.length > 0) {
			const raw = jsDocs[0].getText();
			docText = raw
				.replace(/^\/\*\*\s*/, "")
				.replace(/\s*\*\/$/, "")
				.replace(/^\s*\* ?/gm, "")
				.trim();
		}

		return {
			kind: ts.ScriptElementKind.functionElement,
			kindModifiers: edit.isStatic ? "static" : "",
			textSpan: {
				start: edit.operatorStart,
				length: edit.operatorEnd - edit.operatorStart,
			},
			displayParts: [{ text: prefix + signature, kind: "text" }],
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
	_log: (msg: string) => void,
): tsRuntime.LanguageService {
	// Copy all methods from the underlying language service
	const proxy = Object.create(null) as tsRuntime.LanguageService;
	for (const key of Object.keys(ls)) {
		(proxy as any)[key] = (ls as any)[key];
	}

	// --- Diagnostics: remap output spans ---

	proxy.getSemanticDiagnostics = (fileName) => {
		const result = ls.getSemanticDiagnostics(fileName);
		const sourceMap = getSourceMapForFile(cache, fileName);
		if (!sourceMap) return result;

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
		return result;
	};

	proxy.getSyntacticDiagnostics = (fileName) => {
		const result = ls.getSyntacticDiagnostics(fileName);
		const sourceMap = getSourceMapForFile(cache, fileName);
		if (!sourceMap) return result;

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
		return result;
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
				(e) => position >= e.operatorStart && position < e.operatorEnd,
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
