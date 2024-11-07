import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
// import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    rules: {
      "import/order": [
        "error",
        {
          "newlines-between": "always",
        },
      ],
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
    },
    settings: {
      "import/resolver": {
        typescript: true,
      },
    },
  },
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
    },
  },
  eslintPluginPrettierRecommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "\\."],
              message: 'Please use "@/*" path as defined in tsconfig.json',
            },
          ],
        },
      ],
    },
  },
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  // Waiting on https://github.com/facebook/react/pull/30774
  // {
  //   files: ["**/*.{js,jsx,ts,tsx}"],
  //   languageOptions: {
  //     ecmaVersion: 2020,
  //     // globals: globals.browser,
  //     parserOptions: {
  //       ecmaVersion: "latest",
  //       ecmaFeatures: { jsx: true },
  //       sourceType: "module",
  //     },
  //   },
  //   settings: { react: { version: "detect" } },
  //   ...reactHooks.configs["recommended-latest"],
  // },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: ["config-overrides.js", "eslint.config.mjs"],
  },
);
