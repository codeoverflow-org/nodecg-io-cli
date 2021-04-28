import chalk = require("chalk");
import * as git from "isomorphic-git";
import * as fs from "fs";
import * as http from "isomorphic-git/http/node";
import { directoryExists, executeCommand, removeDirectory } from "../fsUtils";
import { DevelopmentInstallation, writeInstallInfo } from "../installation";
import { logger } from "../log";
import * as path from "path";

type CloneRepository = "nodecg-io" | "nodecg-io-docs";
const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";
const nodecgIODocsCloneURL = "https://github.com/codeoverflow-org/nodecg-io-docs.git";

export async function createDevInstall(
    requested: DevelopmentInstallation,
    current: DevelopmentInstallation | undefined,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
    await getGitRepo(nodecgIODir, "nodecg-io");
    await manageDocs(nodecgIODir, requested.cloneDocs);

    requested.commitHash = await getGitCommitHash(nodecgIODir);
    if (current && requested.commitHash === current?.commitHash) {
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
        await removeDirectory(docsPath);
    }
}

/**
 * Ensures that the current version of nodecg-io/nodecg-io-docs repo is in the passed directory by either cloning the repository or,
 * if already existent, by pulling.
 * @param path the directory to which the repo should be downloaded.
 */
export async function getGitRepo(repoPath: string, repo: CloneRepository): Promise<void> {
    const isDocs = repo === "nodecg-io-docs";
    const gitUrl = isDocs ? nodecgIODocsCloneURL : nodecgIOCloneURL;

    if (await directoryExists(repoPath)) {
        await pullRepo(repoPath, repo, gitUrl);
    } else {
        await cloneRepo(repoPath, repo, gitUrl);
    }
}

async function pullRepo(_directory: string, _repo: CloneRepository, _url: string): Promise<void> {
    // TODO: fix pull. Because we have symlinked and tremendous node_modules directories
    // walking the fs takes waaay too long. Shouldn't isomorphic-git ignore them because they are in the .gitignore?
    // logger.debug(`${repo} git repository is already cloned.`);
    // logger.info("Pulling latest changes...");
    // await git.fastForward(buildGitOpts(directory, url));
    // logger.info(""); // finish progress line
    // logger.info(`Successfully pulled latest changes from GitHub for ${repo}.`);
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
