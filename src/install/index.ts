import { CommandModule } from "yargs";
import * as inquirer from "inquirer";
import { findNodeCGDirectory, getNodeCGIODirectory } from "../utils";
import { createDevInstall } from "./development";
import { ensureConfigContainsBundleDir } from "../nodecgConfig";

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

    const { version } = await inquirer.prompt({
        type: "list",
        name: "version",
        message: "Which version do you want to install?",
        choices: ["development"],
    });
    console.log(`Installing nodecg-io version "${version}"...`);

    // Get packages
    if (version === "development") {
        await createDevInstall(nodecgIODir);
    } else {
        throw `"${version}" is not a vaild version. Cannot install it.`;
    }

    // Add dir to the nodecg config, so that it is loaded.
    await ensureConfigContainsBundleDir(nodecgDir, nodecgIODir);
}
