import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["src/static/**/*.js"]),
  {
    files: ["src/**/*.ts"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  {
    rules: {
      // TODO remove once we have no more "any" types
      "@typescript-eslint/no-explicit-any": "warn",
      "no-sparse-arrays": "off",
    },
  },
]);