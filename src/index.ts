import yargs from "yargs";
import { installModule } from "./install";
import { uninstallModule } from "./uninstall";
import { version } from "../package.json";
import { checkForCliUpdate, ensureNode12 } from "./utils/cli";
import { generateModule } from "./generate";

// This file gets imported by the index.js file of the repository root.

const args = yargs(process.argv.slice(2))
    .scriptName("nodecg-io")
    .usage("$0 <cmd> [args]")
    .version(version)
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

ensureNode12();
(async () => {
    const opts = await args;
    if (!opts["disable-updates"]) {
        checkForCliUpdate();
    }
})();
