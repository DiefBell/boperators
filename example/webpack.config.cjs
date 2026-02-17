const path = require("path");

module.exports = {
	mode: "development",
	devtool: "source-map",
	entry: "./src/index.ts",
	output: {
		filename: "bundle.js",
		path: path.resolve(__dirname, "webpack-dist"),
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
				loader: "@boperators/plugin-webpack",
				exclude: /node_modules/,
			},
		],
	},
};
