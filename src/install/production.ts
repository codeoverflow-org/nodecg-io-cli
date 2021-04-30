import { ProductionInstallation, writeInstallInfo } from "../installation";
import {
    NpmPackage,
    removeNpmPackage,
    isPackageEquals,
    runNpmInstall,
    buildNpmPackagePath,
    downloadNpmPackage,
    createNpmSymlinks,
    getSubPackages,
} from "../npm";
import { directoryExists, ensureDirectory } from "../fsUtils";
import { logger } from "../log";
import { promises as fs } from "fs";
import path = require("path");
import chalk = require("chalk");

export async function createProductionInstall(
    requested: ProductionInstallation,
    current: ProductionInstallation | undefined,
    nodecgIODir: string,
): Promise<void> {
    await ensureDirectory(nodecgIODir);

    if (current) {
        await validateInstall(current, nodecgIODir);
    }

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
    // currently installed but not requested exactly anymore
    const pkgRemove = current.filter((a) => !requested.find((b) => isPackageEquals(a, b)));

    // requested and not already exactly installed (e.g. version change)
    const pkgInstall = requested.filter((a) => !current.find((b) => isPackageEquals(a, b)));

    // Gets sub-packages of packages in pkgInstall that might not be in there.
    // E.g. core got upgraded => nodecg-io-core will be removed and reinstalled
    // nodecg-io-dashboard will also be removed because it is in nodecg-io-core and
    // contained in the directory of the core package. This ensures that the dashboard will
    // also be reinstalled, even though it got no upgrade.
    const installAdditional = pkgInstall.map((pkg) => getSubPackages(requested, pkg)).flat();

    return {
        pkgRemove,
        pkgInstall: [...new Set(pkgInstall.concat(installAdditional))],
    };
}

/**
 * Removes a list of packages from a production nodecg-io install.
 * @param pkgs the packages that should be removed
 * @param state the current installation info that will be updated with the removals
 * @param nodecgIODir the nodecg-io directory in which the packages will be removed
 */
export async function removePackages(
    pkgs: NpmPackage[],
    state: ProductionInstallation,
    nodecgIODir: string,
): Promise<void> {
    for (const pkg of pkgs) {
        logger.debug(`Removing package ${pkg.name} (${pkg.version})...`);
        await removeNpmPackage(pkg, nodecgIODir);
        await saveProgress(state, nodecgIODir, [pkg], false);
    }

    logger.info(`Removed ${pkgs.length} packages.`);
}

/**
 * Installs a list of packages to a nodecg-io install by fetching, extracting and installing the dependencies.
 * @param pkgs the packages that should be installed
 * @param state the current install state that will be updated with the newly added packages
 * @param nodecgIODir the directory in which nodecg-io is installed an and the new packages should be installed into
 */
export async function installPackages(
    pkgs: NpmPackage[],
    state: ProductionInstallation,
    nodecgIODir: string,
): Promise<void> {
    const count = pkgs.length;
    logger.info(`Downloading ${count} packages...`);

    let countDone = 0;
    const updateStatus = () => {
        const text = `${++countDone}/${count} packages downloaded.`;
        process.stdout.write("\r" + chalk.dim(text));
    };

    const downloadPromises = pkgs.map((pkg) => downloadNpmPackage(pkg, nodecgIODir).then(updateStatus));
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

    await createSymlinks(pkgs, nodecgIODir);
    await saveProgress(state, nodecgIODir, pkgs, true);
}

/**
 * Creates the symlinks for all non-hoisted packages. (E.g. monaco-editor for the dashboard)
 */
async function createSymlinks(pkgs: NpmPackage[], nodecgIODir: string): Promise<void> {
    logger.debug("Creating symlinks...");
    await createNpmSymlinks(pkgs, nodecgIODir);
    logger.debug("Successfully created symlinks.");
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

/**
 * Creates a root package.json file with all packages added as a npm v7 workspace.
 * @param pkgs the packages that are installed and should be included in the npm workspace.
 * @param nodecgIODir the directory in which nodecg-io is installed
 */
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

/**
 * Validates a production install by checking that every package that should be installed is actually installed.
 * @param state the current install
 * @param nodecgIODir the directory in which nodecg-io is installed
 */
export async function validateInstall(state: ProductionInstallation, nodecgIODir: string): Promise<void> {
    const pkgs = state.packages;
    const p = pkgs.map(async (pkg) => {
        const pkgPath = buildNpmPackagePath(pkg, nodecgIODir);
        if (!(await directoryExists(pkgPath))) {
            // package is not at the expected location, it may have been deleted by the user.
            // Remove from current state.
            logger.debug(
                `Package ${pkg.name} was expected to be at ${pkgPath} but wasn't. Package will be reinstalled.`,
            );
            pkgs.splice(pkgs.indexOf(pkg), 1);
        }
    });

    await Promise.all(p);
}
