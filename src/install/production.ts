import { ProductionInstallation } from "../installation";
import {
    extractNpmPackageTar,
    createNpmPackageReadStream,
    installNpmDependencies,
    NpmPackage,
    removeNpmPackage,
    isPackageEquals,
} from "../npmPackage";
import { SingleBar } from "cli-progress";
import pLimit = require("p-limit");
import { ensureDirectory } from "../fsUtils";

export async function createProductionInstall(
    requested: ProductionInstallation,
    current: ProductionInstallation | undefined,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
    await ensureDirectory(nodecgIODir);

    const { pkgRemove, pkgInstall } = diffPackages(requested.packages, current?.packages ?? []);

    if (pkgRemove.length > 0) {
        await removePackages(pkgRemove, nodecgIODir);
    }

    if (pkgInstall.length > 0) {
        await installPackages(pkgInstall, nodecgIODir, concurrency);
    }
}

export function diffPackages(
    requested: NpmPackage[],
    current: NpmPackage[],
): { pkgInstall: NpmPackage[]; pkgRemove: NpmPackage[] } {
    return {
        pkgInstall: requested.filter((a) => !current.find((b) => isPackageEquals(a, b))), // requested and not already exactly installed (e.g. version change)
        pkgRemove: current.filter((a) => !requested.find((b) => isPackageEquals(a, b))), // currently installed but not requested exactly anymore
    };
}

// TODO: save install.json after each successful action or add some kind of validation so that the state of the
// install.json doesn't break apart if the user quits the cli within an installation

async function removePackages(pkgs: NpmPackage[], nodecgIODir: string): Promise<void> {
    for (const pkg of pkgs) {
        console.log(`Removing package ${pkg.name} (${pkg.version})...`);
        await removeNpmPackage(pkg, nodecgIODir);
    }

    console.log(`Removed ${pkgs.length} packages.`);
}

async function installPackages(pkgs: NpmPackage[], nodecgIODir: string, concurrency: number): Promise<void> {
    const count = pkgs.length;
    console.log(`Installing ${count} packages (this might take a while)...`);

    let currentlyInstalling: string[] = [];
    const progressBar = new SingleBar({
        format: "Finished {value}/{total} packages [{bar}] {percentage}% {currentlyInstalling}",
    });
    const incBar = (inc: number) => progressBar.increment(inc, { currentlyInstalling: currentlyInstalling.join(", ") });

    // TODO: can we speed this up? It is kinda slow. Maybe add all dependencies into a package.json in the nodecg-io root?
    // would be faster but also would be ugly.

    try {
        progressBar.start(count, 0);

        const limit = pLimit(concurrency);
        const limitedPromises = pkgs.map((pkg) =>
            limit(async () => {
                currentlyInstalling.push(pkg.simpleName);
                incBar(0);

                await installSinglePackage(pkg, nodecgIODir);

                currentlyInstalling = currentlyInstalling.filter((p) => p !== pkg.simpleName);
                incBar(1);
            }),
        );

        await Promise.all(limitedPromises);
    } finally {
        // We must make sure to stop the progress bar because otherwise we'll write at the end of the line of the bar.
        progressBar.stop();
    }

    console.log(`Installed ${count} packages.`);
}

async function installSinglePackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarStream = await createNpmPackageReadStream(pkg);
    await extractNpmPackageTar(pkg, tarStream, nodecgIODir);
    await installNpmDependencies(pkg, nodecgIODir);
}
