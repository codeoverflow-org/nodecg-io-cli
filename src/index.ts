import * as yargs from "yargs";
import { installModule } from "./install";
import { uninstallModule } from "./uninstall";
import { version } from "../package.json";
import { checkForCliUpdate, ensureNode12 } from "./cli";

// This file gets imported by the index.js file of the repository root.

const argv = yargs(process.argv.slice(2))
    .scriptName("nodecg-io")
    .usage("$0 <cmd> [args]")
    .version(version)
    .command(installModule)
    .command(uninstallModule)
    .option("disable-updates", { type: "boolean", description: "Disables check for nodecg-io-cli updates" })
    .strict()
    .demandCommand().argv;

ensureNode12();
if (!argv["disable-updates"]) {
    checkForCliUpdate();
}
