import chalk = require("chalk");
import * as git from "nodegit";
import { directoryExists, executeCommand } from "../fsUtils";
import { DevelopmentInstallation, writeInstallInfo } from "../installation";
import { logger } from "../log";

// TODO: re-implement using isomorphic-git because nodegit is heavy and requires native bindings
// which we don't want as a CLI requirement, native bindings are also not required for most services.
// People shouldn't need to go through those hassles just to get the CLI.

const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";

export async function createDevInstall(
    requested: DevelopmentInstallation,
    current: DevelopmentInstallation | undefined,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
    requested.commitHash = await getGitRepo(nodecgIODir);
    if (requested.commitHash === current?.commitHash) {
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
 * @returns the full git commit hash of the checked out commit
 */
async function getGitRepo(nodecgIODir: string): Promise<string> {
    const repo = (await directoryExists(nodecgIODir)) ? await pullRepo(nodecgIODir) : await cloneRepo(nodecgIODir);
    const headCommit = await repo.getHeadCommit();
    return headCommit.sha();
}

async function pullRepo(nodecgIODir: string): Promise<git.Repository> {
    logger.debug("nodecg-io git repository is already cloned.");
    logger.info("Pulling latest changes...");

    const repo = await git.Repository.open(nodecgIODir);
    await repo.fetchAll();
    const branch = await repo.head();
    await repo.mergeBranches(branch, `origin/${branch.shorthand()}`);

    logger.info("Successfully pulled latest changes from GitHub.");
    return repo;
}

async function cloneRepo(nodecgIODir: string): Promise<git.Repository> {
    logger.info("Cloning nodecg-io git repository...");

    // TODO: does this work even if git is not installed?
    const repo = await git.Clone.clone(nodecgIOCloneURL, nodecgIODir, {
        fetchOpts: {
            callbacks: {
                // Wohoooo broken typings....
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transferProgress: (a: any) => {
                    const text = `Fetched ${a.receivedObjects()}/${a.totalObjects()} objects`;
                    process.stdout.write("\r" + chalk.dim(text));
                },
            },
        },
    });
    logger.info(""); // empty newline after progress indicator

    logger.info("Cloned nodecg-io git repository.");
    return repo;
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
