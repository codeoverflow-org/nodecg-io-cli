module.exports = {
    semi: true,
    trailingComma: "all",
    singleQuote: false,
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    endOfLine: "auto",
    overrides: [
        {
            files: "*.md",
            options: {
                tabWidth: 2,
            },
        },
    ],
};
