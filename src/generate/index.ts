import { CommandModule } from "yargs";
import * as chalk from "chalk";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../utils/log";
import { directoryExists } from "../utils/fs";
import { Installation, ProductionInstallation, readInstallInfo } from "../utils/installation";
import { corePackages } from "../nodecgIOVersions";
import { GenerationOptions, promptGenerationOpts } from "./prompt";
import { getLatestPackageVersion, runNpmBuild, runNpmInstall } from "../utils/npm";
import { genExtension } from "./extension";
import { findNodeCGDirectory, getNodeCGIODirectory, getNodeCGVersion } from "../utils/nodecgInstallation";
import { SemVer } from "semver";
import { genDashboard, genGraphic, genNodeCGDashboardConfig, genNodeCGGraphicConfig } from "./panel";

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

export const yellowInstallCommand = chalk.yellow("nodecg-io install");
const yellowGenerateCommand = chalk.yellow("nodecg-io generate");

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

            await generateBundle(nodecgDir, opts, install);

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
function ensureValidInstallation(install: Installation | undefined): install is ProductionInstallation {
    if (install === undefined) {
        throw new Error(
            "nodecg-io is not installed to your local nodecg install.\n" +
                `Please install it first using this command: ${yellowInstallCommand}`,
        );
    } else if (install.dev) {
        throw new Error(`You cannot use ${yellowGenerateCommand} together with a development installation.`);
    } else if (install.packages.length === corePackages.length) {
        // just has core packages without any services installed.
        throw new Error(
            `You first need to have at least one service installed to generate a bundle.\n` +
                `Please install a service using this command: ${yellowInstallCommand}`,
        );
    }

    return true;
}

export async function generateBundle(
    nodecgDir: string,
    opts: GenerationOptions,
    install: ProductionInstallation,
): Promise<void> {
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
    await genPackageJson(nodecgDir, opts);
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

async function genPackageJson(nodecgDir: string, opts: GenerationOptions): Promise<void> {
    const serviceDeps: [string, string][] = opts.servicePackages.map((pkg) => [pkg.name, addSemverCaret(pkg.version)]);

    const dependencies: [string, string][] = [["nodecg-io-core", addSemverCaret(opts.corePackage.version)]];

    // When we use JS we only need core for requireService etc. and if we TS we also need nodecg, ts, types for node and
    // each service for typings.
    if (opts.language === "typescript") {
        dependencies.push(...serviceDeps);

        logger.debug("Fetching latest typescript and @types/node versions...");
        const [nodecgVersion, latestNodeTypes, latestTypeScript] = await Promise.all([
            getNodeCGVersion(nodecgDir),
            getLatestPackageVersion("@types/node"),
            getLatestPackageVersion("typescript"),
        ]);

        dependencies.push(
            ["nodecg", addSemverCaret(nodecgVersion)],
            ["@types/node", addSemverCaret(latestNodeTypes)],
            ["typescript", addSemverCaret(latestTypeScript)],
        );
        dependencies.sort();
    }

    const content = {
        name: opts.bundleName,
        version: opts.version.version,
        private: true,
        nodecg: {
            compatibleRange: addSemverCaret("1.4.0"),
            bundleDependencies: Object.fromEntries(serviceDeps),
            graphics: genNodeCGGraphicConfig(opts),
            dashboardPanels: genNodeCGDashboardConfig(opts),
        },
        // These scripts are for compiling TS and thus are only needed when generating a TS bundle
        scripts:
            opts.language === "typescript"
                ? {
                      build: "tsc -b",
                      watch: "tsc -b -w",
                      clean: "tsc -b --clean",
                  }
                : undefined,
        dependencies: Object.fromEntries(dependencies),
    };

    await write(content, opts.bundlePath, "package.json");
}

function addSemverCaret(version: string | SemVer): string {
    return `^${version}`;
}

async function genTsConfig(opts: GenerationOptions): Promise<void> {
    // Only TS needs its tsconfig.json compiler configuration
    if (opts.language === "typescript") {
        await write(defaultTsConfigJson, opts.bundlePath, "tsconfig.json");
    }
}

async function genGitIgnore(opts: GenerationOptions): Promise<void> {
    const languageIgnoredFiles = opts.language === "typescript" ? ["/extension/*.js", "/extension/*.js.map"] : [];
    const ignoreEntries = ["/node_modules/", "/.vscode/", "/.idea/", ...languageIgnoredFiles];
    const content = ignoreEntries.join("\n");
    await write(content, opts.bundlePath, ".gitignore");
}

export async function write(content: string | Record<string, unknown>, ...paths: string[]): Promise<void> {
    const finalPath = path.join(...paths);

    logger.debug(`Writing file at ${finalPath}`);

    // Create directory if missing
    const parent = path.dirname(finalPath);
    if (!(await directoryExists(parent))) {
        await fs.promises.mkdir(parent);
    }

    const str = typeof content === "string" ? content : JSON.stringify(content, null, 4);
    await fs.promises.writeFile(finalPath, str);
}
