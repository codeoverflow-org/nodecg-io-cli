import { CommandModule } from "yargs";
import * as path from "path";
import { directoryExists, findNodeCGDirectory, getNodeCGIODirectory, removeDirectory } from "../fsUtils";
import { createDevInstall } from "./development";
import { manageBundleDir } from "../nodecgConfig";
import { promptForInstallInfo } from "./prompt";
import { readInstallInfo } from "../installation";
import { createProductionInstall } from "./production";
import * as os from "os";
import { logger } from "../log";
import { requireNpmV7 } from "../npm";

export const installModule: CommandModule<unknown, { concurrency: number }> = {
    command: "install",
    describe: "installs nodecg-io to your local nodecg installation",

    builder: (yargs) =>
        yargs
            .option("concurrency", {
                alias: "j",
                type: "number",
                description: "The maximum count of concurrent running jobs when building a development install",
                default: os.cpus().length,
            })
            .check((argv) => {
                if (argv.concurrency < 1) throw new Error("Concurrency must be greater than zero.");
                return true;
            }),

    handler: async (argv) => {
        try {
            await install(argv.concurrency);
        } catch (err) {
            logger.error(`Error while installing nodecg-io: ${err}`);
            process.exit(1);
        }
    },
};

async function install(concurrency: number): Promise<void> {
    await requireNpmV7();

    logger.info("Installing nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    logger.debug(`Detected nodecg installation at ${nodecgDir}.`);
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);

    const currentInstall = await readInstallInfo(nodecgIODir);
    const requestedInstall = await promptForInstallInfo(currentInstall);

    // If the minor version changed and we already have another one installed, we need to delete it, so it can be properly installed.
    if (currentInstall && currentInstall.version !== requestedInstall.version && (await directoryExists(nodecgIODir))) {
        logger.info(`Deleting nodecg-io version ${currentInstall.version}...`);
        await removeDirectory(nodecgIODir);
    }

    logger.info(`Installing nodecg-io version ${requestedInstall.version}...`);

    // Get packages
    if (requestedInstall.dev) {
        await createDevInstall(requestedInstall, nodecgIODir, concurrency);
    } else {
        await createProductionInstall(
            requestedInstall,
            currentInstall && !currentInstall.dev ? currentInstall : undefined,
            nodecgIODir,
        );
    }

    // Add bundle dirs to the nodecg config, so that they are loaded.
    await manageBundleDir(nodecgDir, nodecgIODir, true);
    await manageBundleDir(
        nodecgDir,
        path.join(nodecgIODir, "samples"),
        requestedInstall.dev && requestedInstall.useSamples,
    );

    logger.success("Successfully installed nodecg-io.");
}
