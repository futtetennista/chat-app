import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  {
    ignores: ["config-overrides.js"],
  },
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
  // {
  //   rules: {
  //     "import/order": [
  //       "error",
  //       {
  //         groups: [
  //           ["builtin", "external"],
  //           ["internal"],
  //           ["parent", "sibling", "index"],
  //         ],
  //         "newlines-between": "always",
  //       },
  //     ],
  //     "import/newline-after-import": "error",
  //     "import/no-duplicates": "error",
  //   },
  // },
  {
    settings: {
      "import/resolver": {
        typescript: true,
      },
      react: {
        version: "detect",
      },
    },
  },
);
