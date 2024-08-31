import { join } from "path";

export const OPERATOR_SYMBOLS_FILE = join(
	import.meta.dir, // consts
	"..", // cli
	"..", // src
	"lib",
	"operatorSymbols.ts"
);
