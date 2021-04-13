import path = require("path");
import { CommandModule } from "yargs";
import { directoryExists, findNodeCGDirectory, getNodeCGIODirectory, removeDirectory } from "../fsUtils";
import { logger } from "../log";
import { manageBundleDir } from "../nodecgConfig";

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

async function uninstall(): Promise<void> {
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
