import yargs from "yargs";
import { installModule } from "./install/index.js";
import { uninstallModule } from "./uninstall/index.js";
import { checkForCliUpdate, ensureMinimumNodeVersion, getCliVersion } from "./utils/cli.js";
import { generateModule } from "./generate/index.js";

// This file gets imported by the index.js file of the repository root.

ensureMinimumNodeVersion();
(async () => {
    const cliVersion = await getCliVersion();

    const args = yargs(process.argv.slice(2))
        .scriptName("nodecg-io")
        .usage("$0 <cmd> [args]")
        .version(cliVersion)
        .command(installModule)
        .command(uninstallModule)
        .command(generateModule)
        .option("disable-updates", { type: "boolean", description: "Disables check for nodecg-io-cli updates" })
        .strict()
        .demandCommand()
        .parserConfiguration({
            "dot-notation": false,
        })
        .parse();

    ensureMinimumNodeVersion();

    const opts = await args;
    if (!opts["disable-updates"]) {
        checkForCliUpdate();
    }
})();
