import * as path from "path";
import { promises as fs } from "fs";
import { CommandModule } from "yargs";
import { directoryExists } from "../utils/fs.js";
import { logger } from "../utils/log.js";
import { manageBundleDir } from "../utils/nodecgConfig.js";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils/nodecgInstallation.js";

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
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "services"), false);
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "samples"), false);

    // Delete directory
    logger.debug(`Uninstalling nodecg-io from nodecg installation at ${nodecgDir}...`);
    await fs.rm(nodecgIODir, { recursive: true, force: true });

    logger.success("Successfully uninstalled nodecg-io.");
}
