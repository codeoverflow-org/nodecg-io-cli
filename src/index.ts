import * as yargs from "yargs";
import { installModule } from "./install";
import { uninstallModule } from "./uninstall";

// This file gets imported by the index.js file of the repository root.

// TODO: implement update check and log to console if a new version is available.

yargs(process.argv.slice(2))
    .scriptName("nodecg-io")
    .usage("$0 <cmd> [args]")
    .command(installModule)
    .command(uninstallModule)
    .demandCommand().argv;
