#!/usr/bin/env node

import * as yargs from "yargs";
import { installModule } from "./install";

// TODO: make this whole cli more colorful.

yargs(process.argv.slice(2)).scriptName("nodecg-io").usage("$0 <cmd> [args]").command(installModule).demandCommand()
    .argv;
