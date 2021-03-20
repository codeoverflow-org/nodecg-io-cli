import { CommandModule } from "yargs";
import * as path from "path";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils";
import { createDevInstall } from "./development";
import { manageBundleDir } from "../nodecgConfig";
import { promptForInstallInfo } from "./prompt";
import { writeInstallInfo } from "../installation";

export const installModule: CommandModule = {
    command: "install",
    describe: "installs nodecg-io",
    handler: async () => {
        try {
            await install();
        } catch (err) {
            console.error(`Error while installing nodecg-io: ${err}`);
        }
    },
};

async function install(): Promise<void> {
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
        throw `"${info.version}" is not a vaild version. Cannot install it.`;
    }

    // Add bundle dirs to the nodecg config, so that it is loaded.
    await manageBundleDir(nodecgDir, nodecgIODir, true);
    await manageBundleDir(nodecgDir, path.join(nodecgIODir, "samples"), info.dev && info.useSamples);

    await writeInstallInfo(nodecgIODir, info);
}
