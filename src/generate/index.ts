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
import { generateExtension } from "./codegen";
import { findNodeCGDirectory, getNodeCGIODirectory, getNodeCGVersion } from "../utils/nodecgInstallation";

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
    const bundlePath = path.join(opts.bundleDir, opts.bundleName);
    if (!(await directoryExists(bundlePath))) {
        await fs.promises.mkdir(bundlePath);
    }

    const filesInBundleDir = await fs.promises.readdir(bundlePath);
    if (filesInBundleDir.length > 0) {
        logger.error(`Directory for bundle at ${bundlePath} already exists and contains files.`);
        logger.error("Please make sure that you don't have a bundle with the same name already.");
        logger.error(
            `Also you cannot use this tool to add nodecg-io to a already existing bundle. It only supports generating new ones.`,
        );
        process.exit(1);
    }

    await generatePackageJson(nodecgDir, bundlePath, opts);
    await generateTsConfig(bundlePath);
    await generateExtension(bundlePath, opts, install);
    logger.info("Generated bundle successfully.");

    logger.info("Installing dependencies...");
    await runNpmInstall(bundlePath, false);

    logger.info("Compiling bundle...");
    await runNpmBuild(bundlePath);
}

async function generatePackageJson(nodecgDir: string, bundlePath: string, opts: GenerationOptions): Promise<void> {
    // This shouldn't happen...
    if (!opts.servicePackages) throw new Error("servicePackages undefined");
    if (!opts.corePackage) throw new Error("corePackage undefined");

    const serviceDeps = Object.fromEntries(opts.servicePackages.map((pkg) => [pkg.name, "^" + pkg.version]));
    const nodecgVersion = await getNodeCGVersion(nodecgDir);

    logger.debug("Fetching latest typescript and @types/node versions...");
    const latestNodeTypes = await getLatestPackageVersion("@types/node");
    const latestTypeScript = await getLatestPackageVersion("typescript");

    const dependencies = {
        "@types/node": "^" + latestNodeTypes,
        nodecg: "^" + nodecgVersion, // TODO: create extra function to add semver caret operator to a version
        typescript: "^" + latestTypeScript,
        "nodecg-io-core": "^" + opts.corePackage.version,
        ...serviceDeps,
    };

    const content = {
        name: opts.bundleName,
        version: opts.version.version,
        private: true,
        nodecg: {
            compatibleRange: "^1.4.0",
            bundleDependencies: serviceDeps,
        },
        scripts: {
            build: "tsc -b",
            watch: "tsc -b -w",
            clean: "tsc -b --clean",
        },
        dependencies,
    };

    await write(content, bundlePath, "package.json");
}

async function generateTsConfig(bundlePath: string): Promise<void> {
    // TODO: do we want to support ts in dashboard/graphic out of the box?
    // If not we shouldn't try to compile them.
    await write(defaultTsConfigJson, bundlePath, "tsconfig.json");
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
