import { logger } from "./log.js";
import * as chalk from "chalk";
import { getLatestPackageVersion } from "./npm.js";
import semver from "semver";
import { SemVer } from "semver";
import { promises as fs } from "fs";

/**
 * Minimum node.js version that is required to use nodecg-io and this cli.
 */
const minimumNodeVersion = "14.14.0";
/**
 * Name of the package containing the nodecg-io-cli.
 */
const cliPkgName = "nodecg-io-cli";

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
 * Reads the version of the cli from the package.json and returns it.
 */
export async function getCliVersion(): Promise<string> {
    const pkgJsonString = await fs.readFile(new URL("../../package.json", import.meta.url));
    const pkgJson = JSON.parse(pkgJsonString.toString());
    return pkgJson.version;
}

/**
 * Checks for a update of nodecg-io-cli and logs a message with the newest version and update instructions
 * when exiting.
 */
export async function checkForCliUpdate(): Promise<void> {
    try {
        const newestVersion = await getLatestPackageVersion(cliPkgName);
        const cliVersion = await getCliVersion();

        if (newestVersion && semver.gt(newestVersion, cliVersion)) {
            logUpdateOnExit(cliVersion, newestVersion);
        }
    } catch (e) {
        logger.warn(`Cannot check for cli updates: ${e}`);
    }
}

function logUpdateOnExit(currentVersion: string, newestVersion: SemVer) {
    process.on("exit", () => {
        logger.info(
            `There is a nodecg-io-cli update available: ${chalk.yellow(currentVersion)} -> ${chalk.green(
                newestVersion,
            )}`,
        );
        logger.info(`Run the following command to update nodecg-io-cli: ${chalk.blue(`npm i -g ${cliPkgName}`)}`);
    });
}
