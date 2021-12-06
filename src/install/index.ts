import { CommandModule } from "yargs";
import * as path from "path";
import { directoryExists, removeDirectory } from "../utils/fs";
import { createDevInstall } from "./development";
import { manageBundleDir } from "../utils/nodecgConfig";
import { promptForInstallInfo } from "./prompt";
import { readInstallInfo } from "../utils/installation";
import { createProductionInstall } from "./production";
import { logger } from "../utils/log";
import { requireNpmV7 } from "../utils/npm";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils/nodecgInstallation";

export interface InstallCommandOptions {
    "nodecg-io-version"?: string;
    service: Array<string | number>;
    "all-services": boolean;
    docs: boolean;
    samples: boolean;
}

export const installModule: CommandModule<unknown, InstallCommandOptions> = {
    command: "install",
    describe: "installs nodecg-io to your local nodecg installation",
    handler: async (opts) => {
        try {
            await install(opts);
        } catch (err) {
            logger.error(`Error while installing nodecg-io: ${err}`);
            process.exit(1);
        }
    },
    builder: (yargs) =>
        yargs
            .option("nodecg-io-version", {
                type: "string",
                description:
                    'The version of nodecg-io to install. Either "major.minor" for production or "development"',
            })
            .option("service", {
                type: "array",
                description:
                    "The modecg-io services to install alongside the needed components. Only affects production installs.",
                default: [],
            })
            .option("all-services", {
                type: "boolean",
                description: "Whether to install all available services. Only affects production installs.",
                default: false,
            })
            .option("docs", {
                type: "boolean",
                description:
                    "Whether to clone the docs repo into the /docs sub directory. Only available for development installs.",
                default: true,
            })
            .option("samples", {
                type: "boolean",
                description:
                    "Whether to add the samples to your NodeCG configuration. Only available for development installs.",
                default: false,
            }),
};

async function install(opts: InstallCommandOptions): Promise<void> {
    await requireNpmV7();

    logger.info("Installing nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    logger.debug(`Detected nodecg installation at ${nodecgDir}.`);
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);

    let currentInstall = await readInstallInfo(nodecgIODir);
    const requestedInstall = await promptForInstallInfo(currentInstall, opts);

    // If the minor version changed and we already have another one installed, we need to delete it, so it can be properly installed.
    if (currentInstall && currentInstall.version !== requestedInstall.version && (await directoryExists(nodecgIODir))) {
        logger.info(`Deleting nodecg-io version ${currentInstall.version}...`);
        await removeDirectory(nodecgIODir);
        currentInstall = undefined;
    }

    logger.info(`Installing nodecg-io version ${requestedInstall.version}...`);

    // Get packages
    if (requestedInstall.dev) {
        await createDevInstall(requestedInstall, nodecgIODir);
    } else {
        await createProductionInstall(
            requestedInstall,
            currentInstall && !currentInstall.dev ? currentInstall : undefined,
            nodecgIODir,
        );
    }

    // Add bundle dirs to the nodecg config, so that they are loaded.
    await manageBundleDir(nodecgDir, nodecgIODir, true);
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "services"), requestedInstall.version === "development");
    await manageBundleDir(
        nodecgDir,
        path.join(nodecgIODir, "samples"),
        requestedInstall.dev && requestedInstall.useSamples,
    );

    logger.success("Successfully installed nodecg-io.");
}
