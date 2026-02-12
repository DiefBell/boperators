import type { ClassDeclaration, Project as TsMorphProject } from "ts-morph";
import { Node } from "ts-morph";
import type { OverloadStore } from "./OverloadStore";

export type ExportViolationReason =
	| "not-exported-from-file"
	| "not-reachable-from-entry";

export type ExportViolation = {
	className: string;
	classFilePath: string;
	reason: ExportViolationReason;
};

export type ValidateExportsResult = {
	violations: ExportViolation[];
};

/**
 * Validate that all classes with registered operator overloads are exported
 * and (optionally) reachable from a package entry point.
 *
 * @param project     The ts-morph project containing the source files.
 * @param overloadStore  Populated OverloadStore for the project.
 * @param projectDir  Absolute path to the project root — used to filter out
 *                    overloads sourced from library dependencies.
 * @param entryPoint  Absolute path to the source entry point (e.g. `src/index.ts`).
 *                    When provided, a second pass checks that every overload
 *                    class is transitively reachable from this file via its
 *                    export graph. Omit to run the file-level check only.
 */
export function validateExports({
	project,
	overloadStore,
	projectDir,
	entryPoint,
}: {
	project: TsMorphProject;
	overloadStore: OverloadStore;
	projectDir: string;
	entryPoint?: string;
}): ValidateExportsResult {
	const violations: ExportViolation[] = [];

	const normalizedDir = projectDir.replace(/\\/g, "/").replace(/\/$/, "");

	// Deduplicate: collect unique (className, classFilePath) pairs whose
	// source lives inside this project (skip .d.ts from dependencies).
	const seen = new Set<string>();
	const classes: { className: string; classFilePath: string }[] = [];

	for (const overload of overloadStore.getAllOverloads()) {
		const normalized = overload.classFilePath.replace(/\\/g, "/");
		const inProject =
			normalized.startsWith(`${normalizedDir}/`) ||
			normalized === normalizedDir;
		if (!inProject) continue;
		if (normalized.endsWith(".d.ts")) continue;

		const key = `${overload.className}::${normalized}`;
		if (!seen.has(key)) {
			seen.add(key);
			classes.push({
				className: overload.className,
				classFilePath: overload.classFilePath,
			});
		}
	}

	// Level 2 setup: resolve the set of class declarations reachable from the
	// entry point by walking the full export graph (follows re-exports).
	let entryExportedClassDecls: Set<ClassDeclaration> | undefined;
	if (entryPoint) {
		const entryFile =
			project.getSourceFile(entryPoint) ??
			project.addSourceFileAtPath(entryPoint);

		entryExportedClassDecls = new Set();
		for (const decls of entryFile.getExportedDeclarations().values()) {
			for (const decl of decls) {
				if (Node.isClassDeclaration(decl)) {
					entryExportedClassDecls.add(decl);
				}
			}
		}
	}

	// Check each class.
	for (const { className, classFilePath } of classes) {
		const sourceFile = project.getSourceFile(classFilePath);
		if (!sourceFile) continue;

		const classDecl = sourceFile.getClass(className);
		if (!classDecl) continue;

		// Level 1: is the class exported from its own source file?
		if (!classDecl.isExported()) {
			violations.push({
				className,
				classFilePath,
				reason: "not-exported-from-file",
			});
			// If not exported from file it cannot be in the entry point graph
			// either — no need to run the deep check for this class.
			continue;
		}

		// Level 2: is the class reachable from the entry point?
		if (
			entryExportedClassDecls !== undefined &&
			!entryExportedClassDecls.has(classDecl)
		) {
			violations.push({
				className,
				classFilePath,
				reason: "not-reachable-from-entry",
			});
		}
	}

	return { violations };
}
