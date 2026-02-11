import { existsSync, readFileSync } from "node:fs";
import { posix as path } from "node:path";
import type { SourceFile } from "ts-morph";

/**
 * Walk up from a file path to find the nearest `package.json` with a `name`
 * field. Returns the package name and the directory containing it.
 */
function findPackageInfo(
	filePath: string,
): { name: string; dir: string } | undefined {
	const normalized = filePath.replace(/\\/g, "/");
	let dir = path.dirname(normalized);

	while (true) {
		const pkgJsonPath = `${dir}/package.json`;
		if (existsSync(pkgJsonPath)) {
			try {
				const content = readFileSync(pkgJsonPath, "utf-8");
				const pkg = JSON.parse(content);
				if (typeof pkg.name === "string") {
					return { name: pkg.name, dir };
				}
			} catch {
				// Malformed package.json, continue searching up
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break; // filesystem root
		dir = parent;
	}
	return undefined;
}

/**
 * Checks if `fromFile` already imports from `pkgName` (or a subpath of it)
 * and returns that specifier if so. Otherwise returns `pkgName` bare.
 */
function reuseExistingImportOrReturn(
	fromFile: SourceFile,
	pkgName: string,
): string {
	for (const decl of fromFile.getImportDeclarations()) {
		const specifier = decl.getModuleSpecifierValue();
		if (specifier === pkgName || specifier.startsWith(`${pkgName}/`)) {
			return specifier;
		}
	}
	return pkgName;
}

export const getModuleSpecifier = (
	fromFile: SourceFile,
	toFile: SourceFile,
): string => {
	const toPath = toFile.getFilePath();
	const fromPath = fromFile.getFilePath();

	// Check if source and target belong to different packages
	const toPkg = findPackageInfo(toPath);
	const fromPkg = findPackageInfo(fromPath);
	if (toPkg && fromPkg && toPkg.dir !== fromPkg.dir) {
		return reuseExistingImportOrReturn(fromFile, toPkg.name);
	}

	// Same package (or couldn't determine) — use a relative path
	const fromDir = path.dirname(fromPath);
	const relativePath = path.relative(fromDir, toPath);
	return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};
