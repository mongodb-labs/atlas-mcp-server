/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    extensionsToTreatAsEsm: [".ts"],
    testTimeout: 3600000, // 3600 seconds
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1", // Map .js to real paths for ESM
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "tsconfig.jest.json", // Use specific tsconfig file for Jest
            },
        ],
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    setupFilesAfterEnv: ["jest-extended/all"],
    coveragePathIgnorePatterns: ["node_modules", "tests", "dist"],
};
