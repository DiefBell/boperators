/** @type {import("eslint").Linter.Config} */
const config = {
	extends: [
		"./node_modules/@dief/prefs/eslintrc/core.cjs",
	],
	rules: {
		"no-console": "off",
		"@stylistic/arrow-parens": ["error", "always"],
	},
};

module.exports = config;
