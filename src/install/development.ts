import * as git from "nodegit";
import { directoryExists, executeCommand } from "../fsUtils";
import { DevelopmentInstallation } from "../installation";

const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";

export async function createDevInstall(_info: DevelopmentInstallation, nodecgIODir: string): Promise<void> {
    await cloneGitRepo(nodecgIODir);
    await installNPMDependencies(nodecgIODir);
    await buildTypeScript(nodecgIODir);
}

async function cloneGitRepo(nodecgIODir: string) {
    if (await directoryExists(nodecgIODir)) {
        console.log("nodecg-io git repository is already cloned.");
        console.log("Pulling latest changes...");

        const repo = await git.Repository.open(nodecgIODir);
        await repo.fetchAll();
        const branch = await repo.head();
        await repo.mergeBranches(branch, `origin/${branch.name()}`);

        console.log("Succesfully pulled latest changes form GitHub.");
        return;
    }

    console.log("Cloning nodecg-io git repository...");
    await git.Clone.clone(nodecgIOCloneURL, nodecgIODir); // TODO: this sometimes completely locks up, maybe also add a progress indicator
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
