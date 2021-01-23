module.exports = {
	"env": {
		"commonjs": true,
		"es2021": true,
		"node": true,
		"mocha": true
	},
	"extends": [
		"eslint:recommended",
		"plugin:mocha/recommended"
	],
	"parserOptions": {
		"ecmaVersion": 12
	},
	"rules": {
		"indent": ["error", "tab"],
		"semi": ["error", "always"],
		"comma-spacing": ["error", {"after": true}],
		"key-spacing": ["error", {"afterColon": true}],
		"space-in-parens": ["error", "never" ],
		"keyword-spacing": ["error", {"before": true, "after": true}],
		"space-before-blocks": ["error", "always"],
		"arrow-spacing": ["error", {"before": true, "after": true}],
		"brace-style": ["error", "1tbs"]
	},
	"plugins": [
		"mocha"
	]
};
