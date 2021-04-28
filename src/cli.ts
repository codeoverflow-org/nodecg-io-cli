import { version as cliVersion, name as cliPkgName } from "../package.json";
import { logger } from "./log";
import * as chalk from "chalk";
import { getPackageVersions } from "./npm";
import * as semver from "semver";

/**
 * Ensures that the cli is executed with at least node 12. This is the minimum version that is required
 * and if it is older the cli will exit.
 */
export function ensureNode12(): void {
    const nodeVersion = process.versions.node;
    const range = new semver.Range(">=12");

    if (!semver.satisfies(nodeVersion, range)) {
        logger.error("Please update your node installation.");
        logger.error(
            `nodecg-io-cli requires at least node ${chalk.yellowBright("12")}. You have ${chalk.yellowBright(
                nodeVersion,
            )}`,
        );
        process.exit(1);
    }
}

/**
 * Checks for a update of nodecg-io-cli and logs a message with the newest version and update instructions
 * when exiting.
 */
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
