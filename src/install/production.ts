import { ProductionInstallation, writeInstallInfo } from "../installation";
import {
    extractNpmPackageTar,
    createNpmPackageReadStream,
    NpmPackage,
    removeNpmPackage,
    isPackageEquals,
    runNpmInstall,
} from "../npm";
import { ensureDirectory } from "../fsUtils";
import { logger } from "../log";
import * as fs from "fs/promises";
import path = require("path");
import chalk = require("chalk");

// TODO: validate current install to check that all packages it says that are installed are actually installed
// this might happen when a user removes the directory of a package.

export async function createProductionInstall(
    requested: ProductionInstallation,
    current: ProductionInstallation | undefined,
    nodecgIODir: string,
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
        await installPackages(pkgInstall, current, nodecgIODir);
    }
}

/**
 * Finds the removed or added packages between two array of packages (current and requested install).
 * That way we only need to remove what is no longer requested and install what was not already present.
 * When a version differs it will be in both remove and install so you remove the old package first and install
 * the newer version after that.
 *
 * @returns pkgInstall: newly added packages that should be installed,
 *          pkgRemove: packages that are no longer requested and should be removed.
 */
export function diffPackages(
    requested: NpmPackage[],
    current: NpmPackage[],
): { pkgInstall: NpmPackage[]; pkgRemove: NpmPackage[] } {
    return {
        pkgInstall: requested.filter((a) => !current.find((b) => isPackageEquals(a, b))), // requested and not already exactly installed (e.g. version change)
        pkgRemove: current.filter((a) => !requested.find((b) => isPackageEquals(a, b))), // currently installed but not requested exactly anymore
    };
}

// TODO: handle when e.g. core upgrades and removes nodecg-io-core directory. Need to re-download dashboard because it got deleted (or don't delete it).
async function removePackages(pkgs: NpmPackage[], state: ProductionInstallation, nodecgIODir: string): Promise<void> {
    for (const pkg of pkgs) {
        logger.debug(`Removing package ${pkg.name} (${pkg.version})...`);
        await removeNpmPackage(pkg, nodecgIODir);
        await saveProgress(state, nodecgIODir, [pkg], false);
    }

    logger.info(`Removed ${pkgs.length} packages.`);
}

async function installPackages(pkgs: NpmPackage[], state: ProductionInstallation, nodecgIODir: string): Promise<void> {
    const count = pkgs.length;
    logger.info(`Downloading ${count} packages...`);

    let countDone = 0;
    const updateStatus = () => {
        const text = `${++countDone}/${count} packages downloaded.`;
        process.stdout.write("\r" + chalk.dim(text));
    };

    const downloadPromises = pkgs.map((pkg) => fetchSinglePackage(pkg, nodecgIODir).then(updateStatus));
    await Promise.all(downloadPromises);
    logger.info(""); // add newline after the progress indicator which always operates on the same line.

    try {
        logger.info("Installing dependencies... (this might take a while)");
        await installNpmDependencies([...state.packages, ...pkgs], nodecgIODir);
        logger.info(`Installed ${count} packages.`);
    } catch (e) {
        // Removing packages again, because the dependencies couldn't be installed and the packages would result in runtime errors.
        await Promise.all(pkgs.map((p) => removeNpmPackage(p, nodecgIODir)));
        throw e;
    }

    await saveProgress(state, nodecgIODir, pkgs, true);
}

async function fetchSinglePackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarStream = await createNpmPackageReadStream(pkg);
    await extractNpmPackageTar(pkg, tarStream, nodecgIODir);
}

/**
 * Installs the npm dependencies of the passed packages by creating a package.json in the nodecg-io root directory
 * using {@link writeWorkspacePackageJson} and then runs npm install in the nodecg-io directory
 * to install all dependencies of all packages using one command.
 * @param pkgs the packages for which teh dependencies should be installed.
 * @param nodecgIODir the base nodecg-io directory
 */
async function installNpmDependencies(pkgs: NpmPackage[], nodecgIODir: string): Promise<void> {
    await writeWorkspacePackageJson(pkgs, nodecgIODir);
    await runNpmInstall(nodecgIODir);
}

async function writeWorkspacePackageJson(pkgs: NpmPackage[], nodecgIODir: string): Promise<void> {
    logger.debug("Creating package.json file for nodecg-io workspace.");

    const packageJson = {
        name: "nodecg-io",
        private: true,
        workspaces: pkgs.map((p) => p.path),
    };
    const packageJsonString = JSON.stringify(packageJson, null, 4);
    await fs.writeFile(path.join(nodecgIODir, "package.json"), packageJsonString);
}

/**
 * Saves a install or removal of packages to the install.json of the nodecg-io installation.
 *
 * @param state the current state of the installation, this is based on the before installation but will be updated to match the requested one by adding or removing packages
 * @param nodecgIODir the directory in which nodecg-io is/will be installed.
 * @param pkg the newly added or removed package.
 * @param added whether the packages has been installed (true) or removed (false).
 */
async function saveProgress(
    state: ProductionInstallation,
    nodecgIODir: string,
    pkgs: NpmPackage[],
    added: boolean,
): Promise<void> {
    if (added) {
        state.packages.push(...pkgs);
    } else {
        state.packages = state.packages.filter((p) => !pkgs.includes(p));
    }

    await writeInstallInfo(nodecgIODir, state);
}
