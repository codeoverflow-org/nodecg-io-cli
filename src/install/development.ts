import chalk = require("chalk");
import * as git from "isomorphic-git";
import * as fs from "fs";
import * as http from "isomorphic-git/http/node";
import { directoryExists, executeCommand } from "../fsUtils";
import { DevelopmentInstallation, writeInstallInfo } from "../installation";
import { logger } from "../log";

const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";

export async function createDevInstall(
    requested: DevelopmentInstallation,
    current: DevelopmentInstallation | undefined,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
    await getGitRepo(nodecgIODir);
    requested.commitHash = await getGitCommitHash(nodecgIODir);
    if (current && requested.commitHash === current?.commitHash) {
        logger.info("Repository was already up to date. Not building nodecg-io.");
        return;
    }

    await installNPMDependencies(nodecgIODir);
    await buildTypeScript(nodecgIODir, concurrency);

    await writeInstallInfo(nodecgIODir, requested); // save updated install which says that nodecg-io is now installed
}

/**
 * Ensures that the current version of nodecg-io is in the passed directory by either cloning the repository or,
 * if already existent, by pulling.
 * @param nodecgIODir the directory in which nodecg-io should be downloaded to
 */
export async function getGitRepo(nodecgIODir: string): Promise<void> {
    if (await directoryExists(nodecgIODir)) {
        await pullRepo(nodecgIODir);
    } else {
        await cloneRepo(nodecgIODir);
    }
}

async function pullRepo(nodecgIODir: string): Promise<void> {
    logger.debug("nodecg-io git repository is already cloned.");
    logger.info("Pulling latest changes...");

    await git.fastForward({ fs, http, url: nodecgIOCloneURL, dir: nodecgIODir, onProgress: renderGitProgress() });

    logger.info(""); // finish progress line
    logger.info("Successfully pulled latest changes from GitHub.");
}

async function cloneRepo(nodecgIODir: string): Promise<void> {
    logger.info("Cloning nodecg-io git repository...");

    await git.clone({
        fs,
        http,
        dir: nodecgIODir,
        url: nodecgIOCloneURL,
        onProgress: renderGitProgress(),
    });
    logger.info(""); // finish progress line

    logger.info("Cloned nodecg-io git repository.");
}

function renderGitProgress(): git.ProgressCallback {
    let previousPhase: string | undefined;
    return (p) => {
        if (previousPhase && previousPhase !== p.phase) {
            logger.debug(""); // new line for new phase
        }
        previousPhase = p.phase;

        const progress = p.loaded !== p.total ? `${p.loaded}/${p.total ?? "???"}` : "";
        process.stdout.write("\r" + chalk.dim(`${p.phase} ${progress}`));
    };
}

/**
 * Gets the git commit hash of the repo in teh specified directory.
 * @param nodecgIODir the directory of the git repository
 * @returns the sha of the HEAD commit
 */
function getGitCommitHash(nodecgIODir: string): Promise<string> {
    return git.resolveRef({ fs, dir: nodecgIODir, ref: "HEAD" });
}

async function installNPMDependencies(nodecgIODir: string) {
    logger.info("Installing npm dependencies and bootstrapping...");

    await executeCommand("npm", ["install"], nodecgIODir);
    await executeCommand("npm", ["run", "bootstrap"], nodecgIODir);

    logger.info("Installed npm dependencies and bootstrapped.");
}

async function buildTypeScript(nodecgIODir: string, concurrency: number) {
    logger.info("Compiling nodecg-io...");
    await executeCommand("npm", ["run", "build", "--", "--concurrency", concurrency.toString()], nodecgIODir);
    logger.success("Compiled nodecg-io.");
}
