/** @type {import("eslint").Linter.Config} */
const config = {
	extends: [
		"./node_modules/@dief/prefs/eslintrc/core.cjs",
	],
	rules: {
		"no-console": "off",
		"@stylistic/arrow-parens": ["error", "always"],
		"@stylistic/member-delimiter-style": ["warn",
			{
				multiline: {
					delimiter: "semi",
					requireLast: true,
				},
				singleline: {
					delimiter: "semi",
					requireLast: false,
				},
				multilineDetection: "brackets",
			},
		],
		"@stylistic/indent-binary-ops": ["warn", "tab"],
		"@stylistic/indent": ["warn", "tab", {
			offsetTernaryExpressions: true,
		}],
	},
};

module.exports = config;
