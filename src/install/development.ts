import * as git from "nodegit";
import { executeAndStreamOutput } from "../utils";
import * as fs from "fs/promises";

const nodecgIOCloneURL = "https://github.com/codeoverflow-org/nodecg-io.git";

export async function createDevInstall(nodecgIODir: string): Promise<void> {
    await cloneGitRepo(nodecgIODir);
    await installNPMDependencies(nodecgIODir);
    await buildTypeScript(nodecgIODir);
}

async function cloneGitRepo(nodecgIODir: string) {
    try {
        const stats = await fs.stat(nodecgIODir);
        if (stats.isDirectory()) {
            console.log("nodecg-io git repository is already cloned. Skipping clone.");
            // TODO: pull maybe?
            return; // return and be finished
        } else {
            fs.unlink(nodecgIODir); // Actually a file lol, remove it and now clone
        }
    } catch (_err) {
        // Dir doesn't exists, therefore we now clone it
    }

    console.log("Cloning nodecg-io git repository...");
    await git.Clone.clone(nodecgIOCloneURL, nodecgIODir);
    console.log("Cloned nodecg-io git repository.");
}

async function installNPMDependencies(nodecgIODir: string) {
    console.log("Installing npm dependencies and bootstrapping...");

    await executeAndStreamOutput("npm", ["install"], nodecgIODir);
    await executeAndStreamOutput("npm", ["run", "bootstrap"], nodecgIODir);

    console.log("Installed npm dependencies and bootstrapped.");
}

async function buildTypeScript(nodecgIODir: string) {
    console.log("Compiling nodecg-io...");
    await executeAndStreamOutput("npm", ["run", "build"], nodecgIODir);
    console.log("Compiled nodecg-io.");
}
