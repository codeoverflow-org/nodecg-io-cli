import { GenerationOptions } from "./prompt.js";
import { writeBundleFile } from "./utils.js";

/**
 * Generates a tsconfig.json for a bundle if the language was set to typescript.
 */
export async function genTsConfig(opts: GenerationOptions): Promise<void> {
    // Only TS needs its tsconfig.json compiler configuration
    if (opts.language === "typescript") {
        await writeBundleFile(
            {
                extends: "nodecg-io-tsconfig",
            },
            opts.bundlePath,
            "tsconfig.json",
        );
    }
}
