export default {
  env: {
    browser: true,
    es2024: true,
    worker: true,
  },
  rules: {
    yoda: "error",
    "no-var": "error",
    "spaced-comment": ["error", "always"],
    "sort-keys": [
      "error",
      "desc",
      {
        caseSensitive: true,
        minKeys: 2,
        natural: true,
        allowLineSeparatedGroups: false,
      },
    ],
    "sort-imports": [
      "error",
      {
        ignoreCase: false,
        ignoreDeclarationSort: false,
        ignoreMemberSort: false,
        memberSyntaxOrder: ["none", "all", "multiple", "single"],
      },
    ],
  },
};
