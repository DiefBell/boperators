import { boperators } from "@boperators/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [boperators()],
	build: {
		// Keep output readable so CI can grep for the transformed operator call
		minify: false,
	},
});
