import { version as cliVersion, name as cliPkgName } from "../package.json";
import { logger } from "./log";
import * as chalk from "chalk";
import { getPackageVersions } from "./npm";

export async function checkForCliUpdate(): Promise<void> {
    try {
        const versions = await getPackageVersions(cliPkgName);
        const newestVersion = versions[versions.length - 1];

        if (cliVersion !== newestVersion) {
            logUpdateOnExit(newestVersion);
        }
    } catch (e) {
        logger.warn(`Cannot check for cli updates: ${e}`);
    }
}

function logUpdateOnExit(newestVersion: string) {
    process.on("exit", () => {
        logger.info(
            `There is a nodecg-io-cli update available: ${chalk.yellow(cliVersion)} -> ${chalk.green(newestVersion)}`,
        );
        logger.info(`Run the following command to update nodecg-io-cli: ${chalk.blue(`npm i -g ${cliPkgName}`)}`);
    });
}
