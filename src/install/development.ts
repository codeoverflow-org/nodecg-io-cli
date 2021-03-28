import { SingleBar } from "cli-progress";
import * as git from "nodegit";
import { directoryExists, executeCommand } from "../fsUtils";
import { DevelopmentInstallation } from "../installation";

const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";

export async function createDevInstall(_info: DevelopmentInstallation, nodecgIODir: string): Promise<void> {
    await getGitRepo(nodecgIODir);
    await installNPMDependencies(nodecgIODir);
    await buildTypeScript(nodecgIODir);
}

async function getGitRepo(nodecgIODir: string): Promise<void> {
    if (await directoryExists(nodecgIODir)) {
        await pullRepo(nodecgIODir);
    } else {
        await cloneRepo(nodecgIODir);
    }
}

async function pullRepo(nodecgIODir: string): Promise<void> {
    console.log("nodecg-io git repository is already cloned.");
    console.log("Pulling latest changes...");

    const repo = await git.Repository.open(nodecgIODir);
    await repo.fetchAll();
    const branch = await repo.head();
    await repo.mergeBranches(branch, `origin/${branch.name()}`);

    console.log("Succesfully pulled latest changes from GitHub.");
}

async function cloneRepo(nodecgIODir: string): Promise<void> {
    console.log("Cloning nodecg-io git repository...");

    const bar = new SingleBar({
        format: "Cloning... {value}/{total} objects [{bar}] {percentage}%",
    });
    bar.start(0, 0);

    await git.Clone.clone(nodecgIOCloneURL, nodecgIODir, {
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
    console.log("Cloned nodecg-io git repository.");
}

async function installNPMDependencies(nodecgIODir: string) {
    console.log("Installing npm dependencies and bootstrapping...");

    await executeCommand("npm", ["install"], true, nodecgIODir);
    await executeCommand("npm", ["run", "bootstrap"], true, nodecgIODir);

    console.log("Installed npm dependencies and bootstrapped.");
}

async function buildTypeScript(nodecgIODir: string) {
    console.log("Compiling nodecg-io...");
    await executeCommand("npm", ["run", "build"], true, nodecgIODir);
    console.log("Compiled nodecg-io.");
}
