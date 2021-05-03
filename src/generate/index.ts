import { CommandModule } from "yargs";
import * as chalk from "chalk";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../utils/log";
import { directoryExists } from "../utils/fs";
import { ProductionInstallation, readInstallInfo } from "../utils/installation";
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
        const nodecgDir = await findNodeCGDirectory();
        logger.debug(`Detected nodecg installation at ${nodecgDir}.`);
        const nodecgIODir = getNodeCGIODirectory(nodecgDir);
        const install = await readInstallInfo(nodecgIODir);
        if (install === undefined) {
            logger.error("nodecg-io is not installed to your local nodecg install.");
            logger.error(`Please install it first using this command: ${yellowInstallCommand}`);
            process.exit(1);
        } else if (install.dev) {
            logger.error(`You cannot use ${yellowGenerateCommand} together with a development installation.`);
            process.exit(1);
        } else if (install.packages.length === corePackages.length) {
            // just has core packages without any services installed.
            logger.error(`You first need to have at least one service installed to generate a bundle.`);
            logger.error(`Please install a service using this command: ${yellowInstallCommand}`);
            process.exit(1);
        }

        const opts = await promptGenerationOpts(nodecgDir, install);

        try {
            await generateBundle(nodecgDir, opts, install);
        } catch (e) {
            logger.error(`Couldn't generate bundle: ${e}`);
            process.exit(1);
        }

        logger.success(`Successfully generated bundle ${opts.bundleName}.`);
    },
};

async function generateBundle(
    nodecgDir: string,
    opts: GenerationOptions,
    install: ProductionInstallation,
): Promise<void> {
    // Create dir if necessary
    if (!(await directoryExists(opts.bundlePath))) {
        await fs.promises.mkdir(opts.bundlePath);
    }

    const filesInBundleDir = await fs.promises.readdir(opts.bundlePath);
    if (filesInBundleDir.length > 0) {
        logger.error(`Directory for bundle at ${opts.bundlePath} already exists and contains files.`);
        logger.error("Please make sure that you don't have a bundle with the same name already.");
        logger.error(
            `Also you cannot use this tool to add nodecg-io to a already existing bundle. It only supports generating new ones.`,
        );
        process.exit(1);
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
    // TODO: do we want to support ts in dashboard/graphic out of the box?
    // If not we shouldn't try to compile them.

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
