module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    // We don't want to test nodecg, and without including it jest fails because it includes a invalid json
    modulePathIgnorePatterns: ["/nodecg/"],
    testMatch: ["<rootDir>/test/**/**.ts", "!**/testUtils.ts"],
};
