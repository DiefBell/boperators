import path from "path";

const __dirname = import.meta.dirname;

// Go up to package root (works from both src/utils/ and dist/utils/)
export const PACKAGE_ROOT = path.join(__dirname, "..", "..");

// Always resolve to src/ for ts-morph to find .ts source files
export const SRC_ROOT_DIR = path.join(PACKAGE_ROOT, "src");
export const LIB_DIR = path.join(SRC_ROOT_DIR, "lib");
