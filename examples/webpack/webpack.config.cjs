const path = require("node:path");

module.exports = {
	mode: "production",
	entry: "./src/index.ts",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "bundle.js",
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: "ts-loader",
				options: { transpileOnly: true },
				exclude: /node_modules/,
			},
			{
				test: /\.ts$/,
				enforce: "pre",
				loader: "@boperators/webpack-loader",
				exclude: /node_modules/,
			},
		],
	},
};
