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

export const installModule: CommandModule<unknown, { concurrency: number }> = {
    command: "install",
    describe: "installs nodecg-io to your local nodecg installation",
    handler: async () => {
        try {
            await install();
        } catch (err) {
            logger.error(`Error while installing nodecg-io: ${err}`);
            process.exit(1);
        }
    },
};

async function install(): Promise<void> {
    await requireNpmV7();

    logger.info("Installing nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    logger.debug(`Detected nodecg installation at ${nodecgDir}.`);
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);

    let currentInstall = await readInstallInfo(nodecgIODir);
    const requestedInstall = await promptForInstallInfo(currentInstall);

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
