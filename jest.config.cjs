/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    // We don't want to test nodecg, and without including this jest fails because it includes a invalid json
    modulePathIgnorePatterns: ["/nodecg/"],
    testMatch: ["<rootDir>/test/**/*.ts", "!**/*.util.ts"],
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1"
    },
};
