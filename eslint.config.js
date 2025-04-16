import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const files = ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.test.ts", "eslint.config.js", "jest.config.js"];

export default defineConfig([
    { files, plugins: { js }, extends: ["js/recommended"] },
    { files, languageOptions: { globals: globals.node } },
    tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files,
        rules: {
            "@typescript-eslint/switch-exhaustiveness-check": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
        },
    },
    // Ignore features specific to TypeScript resolved rules
    tseslint.config({
        // TODO: Configure tests and scripts to work with this.
        ignores: ["eslint.config.js", "jest.config.js", "tests/**/*.ts", "scripts/**/*.ts"],
    }),
    globalIgnores(["node_modules", "dist", "src/common/atlas/openapi.d.ts", "coverage"]),
    eslintConfigPrettier,
]);
