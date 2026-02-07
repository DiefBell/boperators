import path from "path";

const __dirname = import.meta.dirname;
export const LIB_DIR = path.join(__dirname, "..");
export const SRC_DIR = path.join(
	__dirname,
	"..", // lib/
	"..", // .
	"src"
);