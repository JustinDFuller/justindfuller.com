module.exports = {
	env: {
		browser: true,
		es2024:  true,
		worker:  true,
	},
	rules: {
		"array-bracket-newline": [
			"error",
			{
				minItems:  2,
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
				checkForEach:  false,
			},
		],
		"array-element-newline": [
			"error",
			{
				minItems:  2,
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
				after:  true,
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
				after:  true,
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
		"dot-location":      [
			"error",
			"property",
		],
		"eol-last": [
			"error",
			"always",
		],
		"for-direction":     "error",
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
				after:  false,
				before: true,
			},
		],
		"getter-return":            "error",
		"implicit-arrow-linebreak": [
			"error",
			"beside",
		],

		// Same as gofmt
		indent: [
			"error",
			"tab",
		],
		"jsx-quotes": [
			"error",
			"prefer-double",
		],

		// As close to gofmt as possible
		"key-spacing": [
			"error",
			{
				align: {
					afterColon:  true,
					beforeColon: false,
					mode:        "strict",
					on:          "value",
				},
				multiLine: {
					afterColon:  true,
					beforeColon: false,
					mode:        "strict",
				},
				singleLine: {
					afterColon:  true,
					beforeColon: false,
					mode:        "strict",
				},
			},
		],
		"keyword-spacing": [
			"error",
			{
				after:  true,
				before: true,
			},
		],
		"line-comment-position": [
			"error",
			"above",
		],
		"linebreak-style": [
			"error",
			"unix",
		],
		"lines-around-comment": [
			"error",
			{
				afterBlockComment:    true,
				afterHashbangComment: true,
				afterLineComment:     false,
				allowArrayEnd:        false,
				allowArrayStart:      false,
				allowBlockEnd:        false,
				allowBlockStart:      false,
				allowClassEnd:        false,
				allowClassStart:      false,
				allowObjectEnd:       false,
				allowObjectStart:     false,
				beforeBlockComment:   true,
				beforeLineComment:    true,
			},
		],
		"lines-between-class-members": [
			"error",
			"always",
		],
		"max-len":                 "off",
		"max-statements-per-line": [
			"error",
			{
				max: 1,
			},
		],
		"multiline-ternary": [
			"error",
			"always-multiline",
		],
		"new-parens": [
			"error",
			"never",
		],
		"no-async-promise-executor": "error",

		"no-await-in-loop":              "off",
		"no-class-assign":               "error",
		"no-compare-neg-zero":           "error",
		"no-cond-assign":                "error",
		"no-constant-binary-expression": "error",
		"no-constant-condition":         "error",
		"no-constructor-return":         "error",

		// control regex chars allowed in golang
		"no-control-regex":      "off",
		"no-debugger":           "error",
		"no-dupe-args":          "error",
		"no-dupe-class-members": "error",
		"no-dupe-else-if":       "error",
		"no-dupe-keys":          "error",
		"no-duplicate-case":     "error",
		"no-duplicate-imports":  "error",

		// empty char class is an error in golang
		"no-empty-character-class": "error",
		"no-empty-pattern":         "error",
		"no-ex-assign":             "error",
		"no-extra-parens":          [
			"error",
			"all",
		],
		"no-fallthrough":          "error",
		"no-func-assign":          "error",
		"no-import-assign":        "error",
		"no-inner-declarations":   "error",
		"no-invalid-regexp":       "error",
		"no-irregular-whitespace": [
			"error",
			{
				skipComments:  true,
				skipJSXText:   true,
				skipRegExps:   true,
				skipStrings:   true,
				skipTemplates: true,
			},
		],
		"no-loss-of-precision":          "error",
		"no-misleading-character-class": "error",
		"no-mixed-spaces-and-tabs":      "error",
		"no-multi-spaces":               "error",
		"no-multiple-empty-lines":       [
			"error",
			{
				max:    1,
				maxBOF: 1,
				maxEOF: 1,
			},
		],
		"no-new-native-nonconstructor": "error",
		"no-new-symbol":                "error",
		"no-obj-calls":                 "error",
		"no-promise-executor-return":   "error",
		"no-tabs":                      "off",
		"no-trailing-spaces":           [
			"error",
			{
				ignoreComments: false,
				skipBlankLines: false,
			},
		],
		"no-var":                           "error",
		"no-whitespace-before-property":    "error",
		"nonblock-statement-body-position": [
			"error",
			"below",
		],
		"object-curly-newline": [
			"error",
			{
				consistent: true,
				multiline:  true,
			},
		],
		"object-curly-spacing": [
			"error",
			"always",
			{
				arraysInObjects:  true,
				objectsInObjects: true,
			},
		],
		"object-property-newline": [
			"error",
			{
				allowAllPropertiesOnSameLine: true,
			},
		],
		"object-shorthand": [
			"error",
			"always",
		],
		"one-var": [
			"error",
			"never",
		],
		"one-var-declaration-per-line": "error",
		"operator-assignment":          [
			"error",
			"always",
		],
		"operator-linebreak": [
			"error",
			"none",
		],
		"padded-blocks": [
			"error",
			"never",
		],
		"padding-line-between-statements": [
			"error",

			// These always have a blank line BEFORE
			{ blankLine: "always", next: "break", prev: "*" },
			{ blankLine: "always", next: "continue", prev: "*" },
			{ blankLine: "always", next: "return", prev: "*" },
			{ blankLine: "always", next: "debugger", prev: "*" },
			{ blankLine: "always", next: "debugger", prev: "*" },
			{ blankLine: "always", next: "export", prev: "*" },
			{ blankLine: "always", next: "case", prev: "*" },
			{ blankLine: "always", next: "if", prev: "*" },
			{ blankLine: "always", next: "expression", prev: "*" },

			// These always have a blank line AFTER
			{ blankLine: "always", next: "*", prev: "const" },
			{ blankLine: "always", next: "*", prev: "import" },
			{ blankLine: "always", next: "*", prev: "export" },
			{ blankLine: "always", next: "*", prev: "directive" },
			{ blankLine: "always", next: "*", prev: "if" },
			{ blankLine: "always", next: "*", prev: "case" },
			{ blankLine: "always", next: "*", prev: "expression" },

			// These never have a line BETWEEN
			{ blankLine: "never", next: "const", prev: "const" },
			{ blankLine: "never", next: "let", prev: "let" },
			{ blankLine: "never", next: "import", prev: "import" },
			{ blankLine: "never", next: "expression", prev: "expression" },
		],
		"prefer-arrow-callback":        "error",
		"prefer-const":                 "error",
		"prefer-object-has-own":        "error",
		"prefer-object-spread":         "error",
		"prefer-promise-reject-errors": "error",
		"prefer-regex-literals":        "error",
		"prefer-rest-params":           "error",
		"prefer-spread":                "error",
		"prefer-template":              "error",
		quotes:                         [
			"error",
			"double",
			{
				allowTemplateLiterals: true,
				avoidEscape:           true,
			},
		],
		"rest-spread-spacing": [
			"error",
			"never",
		],
		semi: [
			"error",
			"always",
			{
				omitLastInOneLineBlock:     false,
				omitLastInOneLineClassBody: false,
			},
		],
		"semi-spacing": [
			"error",
			{
				after:  true,
				before: false,
			},
		],
		"semi-style": [
			"error",
			"last",
		],
		"sort-imports": [
			"error",
			{
				allowSeparatedGroups:  false,
				ignoreCase:            false,
				ignoreDeclarationSort: false,
				ignoreMemberSort:      false,
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
				caseSensitive:            true,
				minKeys:                  2,
				natural:                  true,
			},
		],
		"spaced-comment": [
			"error",
			"always",
		],
		yoda: "error",
	},
};
