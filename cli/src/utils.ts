import fs from "node:fs";
import path from "node:path";

/** Resolve tsconfig path relative to cwd if not absolute. */
export function resolveTsConfig(project: string): string {
	const p = path.isAbsolute(project)
		? project
		: path.join(process.cwd(), project);
	if (!fs.existsSync(p)) {
		throw new Error(`Unable to find tsconfig file at "${p}".`);
	}
	return p;
}

/**
 * Compute the common ancestor directory of a set of file paths — this matches
 * what TypeScript does when `rootDir` is not specified in tsconfig.
 */
export function computeCommonSourceDirectory(
	filePaths: string[],
	fallback: string,
): string {
	if (filePaths.length === 0) return fallback;
	const dirs = filePaths.map((p) => path.dirname(p.replaceAll("\\", "/")));
	const segments = dirs.map((d) => d.split("/"));
	const first = segments[0];
	let commonLength = first.length;
	for (const seg of segments.slice(1)) {
		let i = 0;
		while (i < commonLength && i < seg.length && first[i] === seg[i]) {
			i++;
		}
		commonLength = i;
	}
	return first.slice(0, commonLength).join("/") || "/";
}
