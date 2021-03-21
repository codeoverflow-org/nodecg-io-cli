import { CommandModule } from "yargs";
import * as path from "path";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils";
import { createDevInstall } from "./development";
import { manageBundleDir } from "../nodecgConfig";
import { promptForInstallInfo } from "./prompt";
import { writeInstallInfo } from "../installation";
import { createProductionInstall } from "./production";

export const installModule: CommandModule = {
    command: "install",
    describe: "installs nodecg-io",
    handler: async () => {
        try {
            await install();
        } catch (err) {
            console.log();
            console.error(`Error while installing nodecg-io: ${err}`);
            process.exit(1);
        }
    },
};

async function install(): Promise<void> {
    // TODO: read install.json and set defaults to these settings. Only install if there are any changes and remove nodecg-io directory before installing.
    console.log("Installing nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    if (!nodecgDir) {
        throw "Couldn't find a nodecg installation. Make sure that you are in the directory of you nodecg installation.";
    }

    console.log(`Detected nodecg installation at ${nodecgDir}.`);
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);

    const info = await promptForInstallInfo();
    console.log(`Installing nodecg-io version "${info.version}"...`);

    // Get packages
    if (info.dev) {
        await createDevInstall(info, nodecgIODir);
    } else {
        await createProductionInstall(info, nodecgIODir);
    }

    // Add bundle dirs to the nodecg config, so that it is loaded.
    await manageBundleDir(nodecgDir, nodecgIODir, true);
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "samples"), info.dev && info.useSamples);

    await writeInstallInfo(nodecgIODir, info);
}
