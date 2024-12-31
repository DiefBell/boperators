import { plugin, type BunPlugin, type PluginBuilder } from "bun";

const basicPlugin: BunPlugin = {
	name: "basicPlugin",
	target: "bun",
	setup(build: PluginBuilder)
	{
		build.onLoad({ filter: /\.ts$/ }, async (args) =>
		{
			return {
				contents: require("fs").readFileSync(args.path, "utf8"),
				loader: "ts",
			};
		});
	},
};

plugin(basicPlugin);
