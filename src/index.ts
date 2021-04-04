import * as yargs from "yargs";
import { installModule } from "./install";
import { version } from "../package.json";

// This file gets imported by the index.js file of the repository root.
// TODO: test under windows

yargs(process.argv.slice(2))
    .version(version)
    .scriptName("nodecg-io")
    .usage("$0 <cmd> [args]")
    .command(installModule)
    .demandCommand().argv;
