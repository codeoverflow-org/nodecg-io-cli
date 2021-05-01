import { CommandModule } from "yargs";
import * as chalk from "chalk";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../utils/log";
import { directoryExists, executeCommand, findNodeCGDirectory, getNodeCGIODirectory } from "../utils/fs";
import { ProductionInstallation, readInstallInfo } from "../utils/installation";
import { corePackages, getServiceClientName } from "../nodecgIOVersions";
import { GenerationOptions, promptGenerationOpts } from "./prompt";
import * as defaultTsConfigJson from "./tsconfig.json";
import CodeBlockWriter from "code-block-writer";
import { runNpmBuild, runNpmInstall } from "../utils/npm";

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

    await generatePackageJson(bundlePath, opts);
    await generateTsConfig(bundlePath);
    await generateExtension(bundlePath, opts, install);
    logger.info("Generated bundle successfully.");

    logger.info("Installing dependencies...");
    await runNpmInstall(bundlePath, false);

    logger.info("Compiling bundle...");
    await runNpmBuild(bundlePath);
}

async function generatePackageJson(bundlePath: string, opts: GenerationOptions): Promise<void> {
    // This shouldn't happen...
    if (!opts.servicePackages) throw new Error("servicePackages undefined");
    if (!opts.corePackage) throw new Error("corePackage undefined");

    const serviceDeps = Object.fromEntries(opts.servicePackages.map((pkg) => [pkg.name, "^" + pkg.version]));
    const dependencies = {
        "@types/node": "^15.0.1", // TODO: maybe fetch newest version automatically
        nodecg: "^1.8.1", // TODO: get actual nodecg version,
        typescript: "^4.2.4",
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
    await write(defaultTsConfigJson, bundlePath, "tsconfig.json");
}

async function generateExtension(
    bundlePath: string,
    opts: GenerationOptions,
    install: ProductionInstallation,
): Promise<void> {
    const services = opts.services.map((svc) => ({
        name: svc,
        camelCase: kebabCase2CamelCase(svc),
        pascalCase: kebabCase2PascalCase(svc),
        clientName: getServiceClientName(svc, install.version),
    }));

    const writer = new CodeBlockWriter();

    writer.writeLine(`import { NodeCG } from "nodecg/types/server";`);
    writer.writeLine(`import { requireService } from "nodecg-io-core";`);

    // Service import statements
    services.forEach((svc) => {
        writer.writeLine(`import { ${svc.clientName} } from "nodecg-io-${svc.name}";`);
    });

    // global nodecg function
    writer.blankLine();
    writer.write("module.exports = function (nodecg: NodeCG)").block(() => {
        writer.writeLine(`nodecg.log.info("${opts.bundleName} bundle started.");`);
        writer.blankLine();

        // requireService calls
        services.forEach((svc) => {
            writer.writeLine(`const ${svc.camelCase} = requireService<${svc.clientName}>(nodecg, "${svc.name}");`);
        });

        // onAvailable and onUnavailable calls
        services.forEach((svc) => {
            writer.blankLine();

            writer
                .write(`${svc.camelCase}?.onAvailable(async (${svc.camelCase}Client) => `)
                .inlineBlock(() => {
                    writer.writeLine(`nodecg.log.info("${svc.name} client has been updated.")`);
                    writer.writeLine(`// You can now use the ${svc.name} client here.`);
                })
                .write(");");

            writer.blankLine();
            writer.writeLine(
                `${svc.camelCase}?.onUnavailable(() => nodecg.log.info("${svc.name} client has been unset."))`,
            );
        });
    });

    write(writer.toString(), bundlePath, "extension", "index.ts");
}

async function write(content: string | Record<string, unknown>, ...paths: string[]): Promise<void> {
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

function kebabCase2CamelCase(str: string): string {
    const parts = str.split("-");
    const capitalizedParts = parts.map((p, idx) => (idx === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)));
    return capitalizedParts.join("");
}

function kebabCase2PascalCase(str: string): string {
    const camelCase = kebabCase2CamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}
