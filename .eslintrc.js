module.exports = {
	env: {
		browser: true,
		es2024: true,
		worker: true,
	},
	rules: {
		"array-bracket-newline": [
			"error",
			{
				minItems: 2,
				multiline: true,
			},
		],
		"array-bracket-spacing": [
			"error",
			"never",
		],
		"array-callback-return": [
			"error",
			{
				allowImplicit: false,
				checkForEach: false,
			},
		],
		"array-element-newline": [
			"error",
			{
				minItems: 2,
				multiline: true,
			},
		],
		"arrow-parens": [
			"error",
			"always",
		],
		"arrow-spacing": [
			"error",
			{
				after: true,
				before: true,
			},
		],
		"block-spacing": [
			"error",
			"always",
		],
		"brace-style": [
			"error",
			"1tbs",
		],
		"comma-dangle": [
			"error",
			"always-multiline",
		],
		"comma-spacing": [
			"error",
			{
				after: true,
				before: false,
			},
		],
		"comma-style": [
			"error",
			"last",
		],
		"computed-property-spacing": [
			"error",
			"never",
		],
		"constructor-super": "error",
		"dot-location": [
			"error",
			"property",
		],
		"eol-last": [
			"error",
			"always",
		],
		"for-direction": "error",
		"func-call-spacing": [
			"error",
			"never",
		],
		"function-call-argument-newline": [
			"error",
			"consistent",
		],
		"function-paren-newline": [
			"error",
			"multiline",
		],
		"generator-star-spacing": [
			"error",
			{
				after: false,
				before: true,
			},
		],
		"getter-return": "error",
		"implicit-arrow-linebreak": [
			"error",
			"beside",
		],
		indent: [
			"error",
			"tab",
		],
		"no-async-promise-executor": "error",
		"no-await-in-loop": "off",
		"no-class-assign": "error",
		"no-compare-neg-zero": "error",
		"no-cond-assign": "error",
		"no-constant-binary-expression": "error",
		"no-constant-condition": "error",
		"no-constructor-return": "error",
		// control regex chars allowed in golang
		"no-control-regex": "off",
		"no-debugger": "error",
		"no-dupe-args": "error",
		"no-dupe-class-members": "error",
		"no-dupe-else-if": "error",
		"no-dupe-keys": "error",
		"no-duplicate-case": "error",
		"no-duplicate-imports": "error",
		// empty char class is an error in golang
		"no-empty-character-class": "error",
		"no-empty-pattern": "error",
		"no-ex-assign": "error",
		"no-fallthrough": "error",
		"no-func-assign": "error",
		"no-import-assign": "error",
		"no-inner-declarations": "error",
		"no-invalid-regexp": "error",
		"no-irregular-whitespace": [
			"error",
			{
				skipComments: true,
				skipJSXText: true,
				skipRegExps: true,
				skipStrings: true,
				skipTemplates: true,
			},
		],
		"no-loss-of-precision": "error",
		"no-misleading-character-class": "error",
		"no-new-native-nonconstructor": "error",
		"no-new-symbol": "error",
		"no-obj-calls": "error",
		"no-promise-executor-return": "error",
		"no-var": "error",
		"object-shorthand": [
			"error",
			"always",
		],
		"one-var": [
			"error",
			"never",
		],
		"one-var-declaration-per-line": "error",
		"operator-assignment": [
			"error",
			"always",
		],
		"prefer-arrow-callback": "error",
		"prefer-const": "error",
		"prefer-object-has-own": "error",
		"prefer-object-spread": "error",
		"prefer-promise-reject-errors": "error",
		"prefer-regex-literals": "error",
		"prefer-rest-params": "error",
		"prefer-spread": "error",
		"prefer-template": "error",
		"sort-imports": [
			"error",
			{
				allowSeparatedGroups: false,
				ignoreCase: false,
				ignoreDeclarationSort: false,
				ignoreMemberSort: false,
				memberSyntaxSortOrder: [
					"none",
					"all",
					"multiple",
					"single",
				],
			},
		],
		"sort-keys": [
			"error",
			"asc",
			{
				allowLineSeparatedGroups: false,
				caseSensitive: true,
				minKeys: 2,
				natural: true,
			},
		],
		"spaced-comment": [
			"error",
			"always",
		],
		yoda: "error",
	},
};
