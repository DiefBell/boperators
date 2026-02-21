/** @type {import('next').NextConfig} */
const nextConfig = {
	turbopack: {
		root: __dirname,
		rules: {
			"*.{ts,tsx}": {
				loaders: [
					{
						loader: "@boperators/webpack-loader",
						options: { project: "./tsconfig.json" },
					},
				],
				as: "*.tsx",
			},
		},
	},
};

module.exports = nextConfig;
