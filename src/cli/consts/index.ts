import { join } from "path";

export const LIB_ROOT = join(
	import.meta.dir, // consts
	"..", // cli
	"..", // src
	"lib"
);

export const OPERATOR_SYMBOLS_FILE = join(
	LIB_ROOT,
	"operatorSymbols.ts"
);
