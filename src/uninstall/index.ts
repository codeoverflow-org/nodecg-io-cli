import path = require("path");
import { CommandModule } from "yargs";
import { directoryExists, removeDirectory } from "../utils/fs";
import { logger } from "../utils/log";
import { manageBundleDir } from "../utils/nodecgConfig";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils/nodecgInstallation";

export const uninstallModule: CommandModule = {
    command: "uninstall",
    describe: "uninstalls nodecg-io from your local nodecg installation.",

    handler: async () => {
        try {
            await uninstall();
        } catch (err) {
            logger.error(`Error while uninstalling nodecg-io: ${err}`);
            process.exit(1);
        }
    },
};

export async function uninstall(): Promise<void> {
    logger.info("Uninstalling nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);
    if (!(await directoryExists(nodecgIODir))) {
        logger.success("Nodecg-io is currently not installed. No need to uninstall it.");
        return;
    }

    // Remove bundle dirs from nodecg configuration
    await manageBundleDir(nodecgDir, nodecgIODir, false);
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "samples"), false);

    // Delete directory
    logger.debug(`Uninstalling nodecg-io from nodecg installation at ${nodecgDir}...`);
    await removeDirectory(nodecgIODir);

    logger.success("Successfully uninstalled nodecg-io.");
}
