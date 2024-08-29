/** @type {import("eslint").Linter.Config} */
const config = {
	extends: [
		"./node_modules/@dief/prefs/eslintrc/core.cjs",
	],
	rules: {
		"no-console": "off",
	},
};

module.exports = config;
