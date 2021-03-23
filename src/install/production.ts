import { ProductionInstallation } from "../installation";
import * as temp from "temp";
import { extractNpmPackageTar, fetchNpmPackage, installNpmDependencies, NpmPackage } from "../npmPackage";
import * as fs from "fs/promises";
import { SingleBar } from "cli-progress";
import pLimit = require("p-limit");
import * as os from "os";

// Delete temporarily downloaded packages when exiting the CLI.
temp.track();

export async function createProductionInstall(info: ProductionInstallation, nodecgIODir: string): Promise<void> {
    // TODO: (maybe) detect changes in installation request and only remove/add changed packages instead of reinstalling everything
    await ensureNodecgIODirExists(nodecgIODir);

    const count = info.packages.length;
    console.log(`Installing ${count} packages (this might take a while)...`);

    let currentlyInstalling: string[] = [];
    const progressBar = new SingleBar({
        format: "Finished {value}/{total} packages [{bar}] {percentage}% {currentlyInstalling}",
    });

    // TODO: can we speed this up? It is kinda slow. Maybe add all dependencies into a package.json in the nodecg-io root
    // TODO: split this into more and smaller functions.

    try {
        progressBar.start(count, 0);

        // TODO: make concurrency limit configurable using a cli opt.
        const limit = pLimit(Math.max(1, os.cpus().length / 2));
        const limitedPromises = info.packages.map((pkg) =>
            limit(async () => {
                currentlyInstalling = currentlyInstalling.concat(pkg.name);
                progressBar.increment(0, { currentlyInstalling: currentlyInstalling.join(", ") });

                await processPackage(pkg, nodecgIODir);

                currentlyInstalling = currentlyInstalling.filter((p) => p !== pkg.name);
                progressBar.increment(1, { currentlyInstalling: currentlyInstalling.join(", ") });
            }),
        );

        await Promise.all(limitedPromises);
    } finally {
        // We must make sure to stop the progress bar because otherwise we'll write at the end of the line of the bar.
        progressBar.stop();
    }

    console.log(`Installed ${count} packages.`);
}

async function ensureNodecgIODirExists(nodecgIODir: string): Promise<void> {
    try {
        await fs.stat(nodecgIODir); // check whether directory exists
    } catch (_e) {
        await fs.mkdir(nodecgIODir);
    }
}

async function processPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarPath = await fetchPackage(pkg);
    await extractNpmPackageTar(pkg, tarPath, nodecgIODir);
    await installNpmDependencies(pkg, nodecgIODir);
}

async function fetchPackage(pkg: NpmPackage): Promise<string> {
    // Stream from axios to gunzip/untar directly to get rid of these temp files
    const file = await createTempPackageFile(pkg);
    await fetchNpmPackage(pkg, file.path);
    return file.path;
}

async function createTempPackageFile(pkg: NpmPackage): Promise<temp.OpenFile> {
    return new Promise((resolve, reject) => {
        temp.open(`nodecg-io-cli-pkg-${pkg.name}-${pkg.version}`, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
}
