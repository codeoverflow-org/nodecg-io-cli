import { version as cliVersion, name as cliPkgName } from "../../package.json";
import { logger } from "./log";
import * as chalk from "chalk";
import { getLatestPackageVersion } from "./npm";
import * as semver from "semver";
import { SemVer } from "semver";

/**
 * Minimum node.js version that is required to use nodecg-io and this cli.
 */
const minimumNodeVersion = "14.14.0";

/**
 * Ensures that the node.js installation that is used to execute the cli
 * meets the required minimum node.js version for nodecg-io,
 * If it is older the cli will log an error about it and exit.
 */
export function ensureMinimumNodeVersion(): void {
    const nodeVersion = process.versions.node;
    const range = new semver.Range(`>=${minimumNodeVersion}`);

    if (!semver.satisfies(nodeVersion, range)) {
        logger.error("Please update your node installation.");

        const minVer = chalk.yellowBright(minimumNodeVersion);
        const curVer = chalk.yellowBright(nodeVersion);
        logger.error(`nodecg-io-cli requires at least node ${minVer}. You have ${curVer}`);
        process.exit(1);
    }
}

/**
 * Checks for a update of nodecg-io-cli and logs a message with the newest version and update instructions
 * when exiting.
 */
export async function checkForCliUpdate(): Promise<void> {
    try {
        const newestVersion = await getLatestPackageVersion(cliPkgName);

        if (newestVersion && semver.gt(newestVersion, cliVersion)) {
            logUpdateOnExit(newestVersion);
        }
    } catch (e) {
        logger.warn(`Cannot check for cli updates: ${e}`);
    }
}

function logUpdateOnExit(newestVersion: SemVer) {
    process.on("exit", () => {
        logger.info(
            `There is a nodecg-io-cli update available: ${chalk.yellow(cliVersion)} -> ${chalk.green(newestVersion)}`,
        );
        logger.info(`Run the following command to update nodecg-io-cli: ${chalk.blue(`npm i -g ${cliPkgName}`)}`);
    });
}
