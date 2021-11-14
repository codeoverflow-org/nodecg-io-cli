import { CommandModule } from "yargs";
import * as fs from "fs";
import { logger } from "../utils/log";
import { directoryExists } from "../utils/fs";
import { Installation, ProductionInstallation, readInstallInfo } from "../utils/installation";
import { corePackages } from "../nodecgIOVersions";
import { GenerationOptions, promptGenerationOpts } from "./prompt";
import { runNpmBuild, runNpmInstall } from "../utils/npm";
import { genExtension } from "./extension";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils/nodecgInstallation";
import { genDashboard, genGraphic } from "./panel";
import { genTsConfig } from "./tsConfig";
import { writeBundleFile, yellowGenerateCommand, yellowInstallCommand } from "./utils";
import { genPackageJson } from "./packageJson";

export const generateModule: CommandModule = {
    command: "generate",
    describe: "generates nodecg bundles that use nodecg-io services",

    handler: async () => {
        try {
            const nodecgDir = await findNodeCGDirectory();
            logger.debug(`Detected nodecg installation at ${nodecgDir}.`);
            const nodecgIODir = getNodeCGIODirectory(nodecgDir);
            const install = await readInstallInfo(nodecgIODir);

            // Will throw when install is not valid for generating bundles
            if (!ensureValidInstallation(install)) return;

            const opts = await promptGenerationOpts(nodecgDir, install);

            await generateBundle(opts, install);

            logger.success(`Successfully generated bundle ${opts.bundleName}.`);
        } catch (e) {
            logger.error(`Couldn't generate bundle:\n${e.message ?? e.toString()}`);
            process.exit(1);
        }
    },
};

/**
 * Ensures that a installation can be used to generate bundles, meaning nodecg-io is actually installed,
 * is not a dev install and has some services installed that can be used.
 * Throws an error if the installation cannot be used to generate a bundle with an explanation.
 */
export function ensureValidInstallation(install: Installation | undefined): install is ProductionInstallation {
    if (install === undefined) {
        throw new Error(
            "nodecg-io is not installed to your local nodecg install.\n" +
                `Please install it first using this command: ${yellowInstallCommand}`,
        );
    } else if (install.dev) {
        throw new Error(`You cannot use ${yellowGenerateCommand} together with a development installation.`);
    } else if (install.packages.length <= corePackages.length) {
        // just has core packages without any services installed.
        throw new Error(
            `You first need to have at least one service installed to generate a bundle.\n` +
                `Please install a service using this command: ${yellowInstallCommand}`,
        );
    }

    return true;
}

export async function generateBundle(opts: GenerationOptions, install: ProductionInstallation): Promise<void> {
    // Create dir if necessary
    if (!(await directoryExists(opts.bundlePath))) {
        await fs.promises.mkdir(opts.bundlePath);
    }

    // In case some re-executes the command in a already used bundle name we should not overwrite their stuff and error instead.
    const filesInBundleDir = await fs.promises.readdir(opts.bundlePath);
    if (filesInBundleDir.length > 0) {
        throw new Error(
            `Directory for bundle at ${opts.bundlePath} already exists and contains files.\n` +
                "Please make sure that you don't have a bundle with the same name already.\n" +
                `Also you cannot use this tool to add nodecg-io to a already existing bundle. It only supports generating new ones.`,
        );
    }

    // All of these calls only generate files if they are set accordingly in the GenerationOptions
    await genPackageJson(opts);
    await genTsConfig(opts);
    await genGitIgnore(opts);
    await genExtension(opts, install);
    await genGraphic(opts);
    await genDashboard(opts);
    logger.info("Generated bundle successfully.");

    logger.info("Installing dependencies...");
    await runNpmInstall(opts.bundlePath, false);

    // JavaScript does not to be compiled
    if (opts.language === "typescript") {
        logger.info("Compiling bundle...");
        await runNpmBuild(opts.bundlePath);
    }
}

async function genGitIgnore(opts: GenerationOptions): Promise<void> {
    // When typescript we want to ignore compilation results.
    const languageIgnoredFiles = opts.language === "typescript" ? ["/extension/*.js", "/extension/*.js.map"] : [];
    // Usual editors and node_modules directory
    const ignoreEntries = ["/node_modules/", "/.vscode/", "/.idea/", ...languageIgnoredFiles];
    const content = ignoreEntries.join("\n");
    await writeBundleFile(content, opts.bundlePath, ".gitignore");
}
