import { fixupPluginRules } from "@eslint/compat";
import js from "@eslint/js";
import markdown from "@eslint/markdown";
import prettier from "eslint-config-prettier/flat";
import cypress from "eslint-plugin-cypress";
import { flatConfigs as importX } from "eslint-plugin-import-x";
import jest from "eslint-plugin-jest";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import testingLibrary from "eslint-plugin-testing-library";
import globals from "globals";
import tseslint from "typescript-eslint";

// The React and accessibility plugins haven't caught up with ESLint 10,
// which dropped some methods they call; this puts them back
const reactPlugin = fixupPluginRules(react);
const jsxA11yPlugin = fixupPluginRules(jsxA11y);

// The recommended rules of each plugin, as before the move to ESLint's
// flat config, plus the few we set ourselves
export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "build/",
      "build-check/",
      "public/build/",
      "coverage/",
      ".react-router/",
      ".cache/",
    ],
  },

  // Base
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.commonjs, ...globals.es2021 },
    },
  },

  // React
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: react.configs.flat.recommended.languageOptions,
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11yPlugin,
    },
    settings: {
      react: { version: "detect" },
      formComponents: ["Form"],
      linkComponents: [
        { name: "Link", linkAttribute: "to" },
        { name: "NavLink", linkAttribute: "to" },
      ],
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      // The two hooks rules from before; the newer React Compiler rules
      // are a change of their own
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
    },
  },

  // TypeScript
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      importX.recommended,
      importX.typescript,
    ],
    settings: {
      "import-x/internal-regex": "^~/",
      "import-x/resolver": {
        node: { extensions: [".ts", ".tsx"] },
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      "import-x/order": [
        "error",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          "newlines-between": "always",
        },
      ],
    },
  },

  // Code blocks in Markdown
  {
    files: ["**/*.md"],
    extends: [markdown.configs.processor],
  },

  // Tests
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    extends: [
      jest.configs["flat/recommended"],
      jestDom.configs["flat/recommended"],
      testingLibrary.configs["flat/react"],
    ],
    // Vitest's API is close to Jest's, so its rules fit; they need to be
    // told which Jest to expect
    settings: { jest: { version: 28 } },
  },

  // Cypress
  {
    files: ["cypress/**/*.ts"],
    extends: [cypress.configs.recommended],
  },

  // Node scripts and config
  {
    files: ["*.config.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
