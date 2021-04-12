import * as yargs from "yargs";
import { installModule } from "./install";
import { version } from "../package.json";
import { uninstallModule } from "./uninstall";

// This file gets imported by the index.js file of the repository root.

yargs(process.argv.slice(2))
    .version(version)
    .scriptName("nodecg-io")
    .usage("$0 <cmd> [args]")
    .command(installModule)
    .command(uninstallModule)
    .demandCommand().argv;
