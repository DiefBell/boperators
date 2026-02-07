import { fileURLToPath } from "bun";
import path from "path";

export const __dirname = () => fileURLToPath(import.meta.dirname);
export const ROOT_DIR = path.join(__dirname(), "..");