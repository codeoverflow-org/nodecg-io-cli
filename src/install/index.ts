import { CommandModule } from "yargs";

export const installModule: CommandModule = {
    command: "install",
    describe: "installs nodecg-io",
    handler: () => {
        console.log("Installing nodecg-io...");
        // TODO: ask for version and install
    },
}
