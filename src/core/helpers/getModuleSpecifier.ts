import { posix as path } from "path";
import type { SourceFile } from "ts-morph";

export const getModuleSpecifier = (fromFile: SourceFile, toFile: SourceFile): string =>
{
	const fromDir = path.dirname(fromFile.getFilePath());
	const toPath = toFile.getFilePath();
	const relativePath = path.relative(fromDir, toPath);
	// Ensure the path uses './' if it's a relative path
	return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};
