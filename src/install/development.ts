import chalk = require("chalk");
import * as git from "isomorphic-git";
import * as fs from "fs";
import * as http from "isomorphic-git/http/node";
import { directoryExists, executeCommand, removeDirectory } from "../fsUtils";
import { DevelopmentInstallation, writeInstallInfo } from "../installation";
import { logger } from "../log";
import * as path from "path";
import * as glob from "glob";

type CloneRepository = "nodecg-io" | "nodecg-io-docs";
const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";
const nodecgIODocsCloneURL = "https://github.com/codeoverflow-org/nodecg-io-docs.git";

export async function createDevInstall(
    requested: DevelopmentInstallation,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
    const wasRepoUpdated = await getGitRepo(nodecgIODir, "nodecg-io");
    await manageDocs(nodecgIODir, requested.cloneDocs);

    if (wasRepoUpdated === false) {
        logger.info("Repository was already up to date. Not building nodecg-io.");
        // useSamples or cloneDocs might have changed and need to be saved, even if not building nodecg-io
        await writeInstallInfo(nodecgIODir, requested);
        return;
    }

    await installNPMDependencies(nodecgIODir);
    await buildTypeScript(nodecgIODir, concurrency);

    await writeInstallInfo(nodecgIODir, requested); // save updated install which says that nodecg-io is now installed
}

/**
 * Ensures that docs are cloned and up to date if they are wanted and removes them, if existing, if they are not requested.
 * @param nodecgIODir the directory in which nodecg-io is installed
 * @param cloneDocs whether the docs should be cloned or not
 */
async function manageDocs(nodecgIODir: string, cloneDocs: boolean): Promise<void> {
    const docsPath = path.join(nodecgIODir, "docs");
    if (cloneDocs) {
        // Docs are wanted so we clone/pull them.
        await getGitRepo(docsPath, "nodecg-io-docs");
    } else if (await directoryExists(docsPath)) {
        // Docs are not wanted but exists (they probably were selected previously) => delete
        logger.debug("Removing docs...");
        await removeDirectory(docsPath);
    }
}

/**
 * Ensures that the current version of nodecg-io/nodecg-io-docs repo is in the passed directory by either cloning the repository or,
 * if already existent, by pulling.
 * @param path the directory to which the repo should be downloaded.
 * @returns true if there were any new changes (cloned or pulled with new commits) and false if nothing changed (pull but already up to date)
 */
export async function getGitRepo(repoPath: string, repo: CloneRepository): Promise<boolean> {
    const isDocs = repo === "nodecg-io-docs";
    const gitUrl = isDocs ? nodecgIODocsCloneURL : nodecgIOCloneURL;

    if (await directoryExists(repoPath)) {
        return await pullRepo(repoPath, repo, gitUrl);
    } else {
        await cloneRepo(repoPath, repo, gitUrl);
        return true;
    }
}

async function pullRepo(directory: string, repo: CloneRepository, url: string): Promise<boolean> {
    logger.debug(`${repo} git repository is already cloned.`);
    logger.info("Pulling latest changes...");

    const currentCommit = await getGitCommitHash(directory);
    const fetchResult = await git.fetch(buildGitOpts(directory, url));

    if (fetchResult.fetchHead === null || fetchResult.fetchHead === currentCommit) {
        logger.info(`No new changes for ${repo}.`);
        return false;
    }

    // There are changes that we now need to fast-forward and checkout

    // fast-forward
    await git.merge({
        ...buildGitOpts(directory, url),
        ours: currentCommit,
        theirs: fetchResult.fetchHead,
        fastForwardOnly: true,
    });

    if (repo === "nodecg-io") {
        // isomorphic-git is far from perfect and has some problems compared to libgit2.
        // One of them is that when performing a checkout it will always walk the whole working directory
        // INCLUDING gitignored directories like node_modules.
        // Because of the tremendous size of node_modules in combination with all the symlinks of it
        // this would result in far more than 500000 file checks which is waaaay tooo sloooow.
        // To work around this we remove the node_modules directories if we need to perform a checkout
        // and live with the "small" (in comparison) performance penalty of needing to re-install all node dependencies
        // even if only a small subset or nothing changed. Since this is only done when manually updating and only
        // if any new commits were fetched this is acceptable.
        await deleteNodeModuleDirectories(directory);
    }

    await git.checkout(buildGitOpts(directory, url));

    logger.info(""); // finish progress line
    logger.info(`Successfully pulled latest changes from GitHub for ${repo}.`);
    return true;
}

/**
 * Deletes all node_modules directories in the passed nodecg-io installation.
 * @param nodecgIODir the directory in which nodecg-io is installed
 */
async function deleteNodeModuleDirectories(nodecgIODir: string): Promise<void> {
    logger.debug("Deleting node_modules directories...");
    const nodeModuleDirs = await new Promise<string[]>((resolve, reject) => {
        glob(`${nodecgIODir}/**/node_modules`, {}, (err, matches) => {
            if (err) reject(err);
            else resolve(matches);
        });
    });

    for (const nodeModuleDir of nodeModuleDirs) {
        if (await directoryExists(nodeModuleDir)) {
            await removeDirectory(nodeModuleDir);
        }
    }

    logger.debug("Deleted node_modules directories.");
}

async function cloneRepo(directory: string, repo: CloneRepository, url: string): Promise<void> {
    logger.info(`Cloning ${repo} git repository...`);

    await git.clone(buildGitOpts(directory, url));
    logger.info(""); // finish progress line

    logger.info(`Cloned ${repo} git repository.`);
}

function buildGitOpts(directory: string, url: string) {
    return {
        fs,
        http,
        url,
        dir: directory,
        onProgress: renderGitProgress(),
    };
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
 * @param dir the directory of the git repository
 * @returns the sha of the HEAD commit
 */
function getGitCommitHash(dir: string): Promise<string> {
    return git.resolveRef({ fs, dir, ref: "HEAD" });
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
