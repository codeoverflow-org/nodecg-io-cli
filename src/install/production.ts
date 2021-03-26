import { ProductionInstallation } from "../installation";
import { extractNpmPackageTar, createNpmPackageReadStream, installNpmDependencies, NpmPackage } from "../npmPackage";
import { SingleBar } from "cli-progress";
import pLimit = require("p-limit");
import * as os from "os";
import { ensureDirectory } from "../fsUtils";

export async function createProductionInstall(info: ProductionInstallation, nodecgIODir: string): Promise<void> {
    // TODO: (maybe) detect changes in installation request and only remove/add changed packages instead of reinstalling everything
    await ensureDirectory(nodecgIODir);

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
        // TODO: show only service/component name in progress bar without the nodecg-io prefix
        // all of those are nodecg-io components to that is redudant and makes the list unneccesarily long.
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

async function processPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarStream = await createNpmPackageReadStream(pkg);
    await extractNpmPackageTar(pkg, tarStream, nodecgIODir);
    await installNpmDependencies(pkg, nodecgIODir);
}
