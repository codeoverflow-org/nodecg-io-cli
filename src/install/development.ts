import chalk = require("chalk");
import { SingleBar } from "cli-progress";
import * as git from "nodegit";
import { directoryExists, executeCommand } from "../fsUtils";
import { DevelopmentInstallation } from "../installation";
import { logger } from "../log";

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
}

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

    const bar = new SingleBar({
        format: chalk.dim("Cloning... {value}/{total} objects [{bar}] {percentage}%"),
    });
    bar.start(0, 0);

    const repo = await git.Clone.clone(nodecgIOCloneURL, nodecgIODir, {
        fetchOpts: {
            callbacks: {
                // Wohoooo broken typings....
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                transferProgress: (a: any) => {
                    bar.setTotal(a.totalObjects());
                    bar.update(a.receivedObjects());
                },
            },
        },
    });

    bar.stop();
    logger.info("Cloned nodecg-io git repository.");
    return repo;
}

async function installNPMDependencies(nodecgIODir: string) {
    logger.info("Installing npm dependencies and bootstrapping...");

    await executeCommand("npm", ["install"], true, nodecgIODir);
    await executeCommand("npm", ["run", "bootstrap"], true, nodecgIODir);

    logger.info("Installed npm dependencies and bootstrapped.");
}

async function buildTypeScript(nodecgIODir: string, concurrency: number) {
    logger.info("Compiling nodecg-io...");
    await executeCommand("npm", ["run", "build", "--", "--concurrency", concurrency.toString()], true, nodecgIODir);
    logger.success("Compiled nodecg-io.");
}
