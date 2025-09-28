module.exports = {
  root: true,
  env: {
    es2023: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    "import/order": [
      "warn",
      {
        "newlines-between": "always",
        "alphabetize": { order: "asc", caseInsensitive: true },
      },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports" }
    ],
  },
  ignorePatterns: ["dist", "node_modules"],
};
