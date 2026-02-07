import path from "path";

// Go up to package root (works from both src/utils/ and dist/utils/)
export const PACKAGE_ROOT = path.join(__dirname, "..", "..");

export const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, "package.json");

// Always resolve to src/ for ts-morph to find .ts source files
export const SRC_ROOT_DIR = path.join(PACKAGE_ROOT, "src");
export const OPERATOR_SYMBOLS_FILE = path.join(SRC_ROOT_DIR, "lib", "operatorSymbols.ts");

export const LIB_DIR = path.join(__dirname, "..", "lib");
