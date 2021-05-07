import { GenerationOptions } from "./prompt";
import { writeBundleFile } from "./utils";

const defaultTsConfigJson = {
    compilerOptions: {
        target: "es2019",
        sourceMap: true,
        lib: ["es2019"],
        alwaysStrict: true,
        forceConsistentCasingInFileNames: true,
        noFallthroughCasesInSwitch: true,
        noImplicitAny: true,
        noImplicitReturns: true,
        noImplicitThis: true,
        strictNullChecks: true,
        skipLibCheck: true,
        module: "CommonJS",
        types: ["node"],
    },
};

/**
 * Generates a tsconfig.json for a bundle if the language was set to typescript.
 */
export async function genTsConfig(opts: GenerationOptions): Promise<void> {
    // Only TS needs its tsconfig.json compiler configuration
    if (opts.language === "typescript") {
        await writeBundleFile(defaultTsConfigJson, opts.bundlePath, "tsconfig.json");
    }
}
