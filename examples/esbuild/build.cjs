const { build } = require("esbuild");
const { boperators } = require("@boperators/plugin-esbuild");

build({
	entryPoints: ["src/index.ts"],
	outfile: "dist/bundle.js",
	bundle: true,
	platform: "node",
	absWorkingDir: __dirname,
	plugins: [boperators()],
}).catch(process.exit);
