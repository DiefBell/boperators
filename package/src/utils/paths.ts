import path from "path";

// Go up to package root (works from both src/utils/ and dist/utils/)
export const PACKAGE_ROOT = path.join(__dirname, "..", "..");

export const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, "package.json");

export const LIB_DIR = path.join(__dirname, "..", "lib");
