import { ProductionInstallation, writeInstallInfo } from "../installation";
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

    if (current === undefined) {
        current = { ...requested, packages: [] };
    }

    if (pkgRemove.length > 0) {
        await removePackages(pkgRemove, current, nodecgIODir);
    }

    if (pkgInstall.length > 0) {
        await installPackages(pkgInstall, current, nodecgIODir, concurrency);
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

async function removePackages(pkgs: NpmPackage[], state: ProductionInstallation, nodecgIODir: string): Promise<void> {
    for (const pkg of pkgs) {
        console.log(`Removing package ${pkg.name} (${pkg.version})...`);
        await removeNpmPackage(pkg, nodecgIODir);
        await saveProgress(state, nodecgIODir, pkg, false);
    }

    console.log(`Removed ${pkgs.length} packages.`);
}

async function installPackages(
    pkgs: NpmPackage[],
    state: ProductionInstallation,
    nodecgIODir: string,
    concurrency: number,
): Promise<void> {
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
                await saveProgress(state, nodecgIODir, pkg, true);

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
    // If the user quits the cli while we install a package we don't want to leave it partially installed because:
    // 1. not all necesarry files may have been extracted => won't work when accessing those files
    // 2. npm i hasn't installed all packages yet => runtime error because the dependencies cannot be found
    // Which is both bad for the user. Therefore we delete it if the user quits and the package is not fully installed.
    const callback = () => removeNpmPackage(pkg, nodecgIODir);
    process.on("SIGINT", callback);

    const tarStream = await createNpmPackageReadStream(pkg);
    await extractNpmPackageTar(pkg, tarStream, nodecgIODir);
    await installNpmDependencies(pkg, nodecgIODir);

    process.off("SIGINT", callback); // disable callback again, this package is now fully installed and usable
}

/**
 * Saves a install or removal of a package to the install.json of the nodecg-io installation.
 * We do this to save all finished actions so that if the user decides to kill the cli while installing nodecg-io
 * we will know which packages have been removed/added and don't fall back to the state before the installation.
 *
 * E.g. a user wants to remove a service and add another:
 * 1. Remove service 1 -> save
 * 2. Install service 2, but user kills cli.
 * Because we saved after each finished step we known that service 1 is no longer installed and also service 2 is not installed.
 *
 * @param state the current state of the installation, this is based on the before installation but will be updated to match the requested one by adding or removing packages
 * @param nodecgIODir the directory in which nodecg-io is/will be installed.
 * @param pkg the newly added or removed package.
 * @param added whether the packages has been installed (true) or removed (false).
 */
async function saveProgress(
    state: ProductionInstallation,
    nodecgIODir: string,
    pkg: NpmPackage,
    added: boolean,
): Promise<void> {
    if (added) {
        state.packages.push(pkg);
    } else {
        const pkgIdx = state.packages.indexOf(pkg);
        if (pkgIdx !== -1) {
            state.packages.splice(pkgIdx, 1);
        }
    }

    await writeInstallInfo(nodecgIODir, state);
}
