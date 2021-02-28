import { CommandModule } from "yargs";
import *  as inquirer from "inquirer";
import { findNodeCGDirectory } from "../utils";

export const installModule: CommandModule = {
    command: "install",
    describe: "installs nodecg-io",
    handler: async () => {
        console.log("Installing nodecg-io...");
        const versionResult = await inquirer.prompt({
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: ["development"]
        });
        console.log(versionResult);

        const nodecgDir = await findNodeCGDirectory();
        if(!nodecgDir) {
            console.error("Couldn't find a nodecg installation. Make sure that you are in the directory of you nodecg installation.");
            return;
        }
        console.log(`Detected nodecg installation at ${nodecgDir}.`);

        // TODO: download from git, install, bootstrap, compile and add to nodecg config
    },
}
