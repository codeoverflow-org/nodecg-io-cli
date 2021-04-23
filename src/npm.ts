import axios from "axios";
import * as semver from "semver";
import * as fs from "fs";
import * as path from "path";
import gunzip = require("gunzip-maybe");
import tar = require("tar-fs");
import { executeCommand, removeDirectory } from "./fsUtils";
import { exec } from "child_process";

const npmRegistryEndpoint = "https://registry.npmjs.org/";

/**
 * Information about a npm package that will be fetched by a prod install with name, installed version
 * and the path where the package should be installed.
 */
export interface NpmPackage {
    name: string;
    // TODO: is simple name still needed?
    simpleName: string; // name that will be used when logging something about the package
    path: string;
    version: string;
}

/**
 * Checks whether two {@link NpmPackage} are the complete same package. Meaning every field has to be the same for this to return true.
 * @returns
 */
export function isPackageEquals(a: NpmPackage, b: NpmPackage): boolean {
    return a.name === b.name && a.path === b.path && a.version === b.version && a.simpleName === b.simpleName;
}

/**
 * Gets all version for the passed package that are available at the official npm registry.
 * @param packageName which package you want the versions to.
 * @returns the versions of the package
 */
export async function getPackageVersions(packageName: string): Promise<string[]> {
    const response = await axios(npmRegistryEndpoint + packageName);
    return Object.keys(response.data.versions);
}

/**
 * Gets all the minor versions of this package that are available at the official npm registry.
 * This means all patch versions are filtered out and you only get "major.minor" back.
 * @param packageName which packages you want the minor/major versions to.
 * @returns the minor versions of the package
 */
export async function getMinorVersions(packageName: string): Promise<string[]> {
    const allVersions = await getPackageVersions(packageName);
    const majorMinorVersions = allVersions.map((version) => {
        const { major, minor } = new semver.SemVer(version);
        return `${major}.${minor}`;
    });
    return [...new Set(majorMinorVersions)];
}

/**
 * Gets the highest patch version of the passed package and the passed major.minor version.
 * E.g. if majorMinor is "0.1" it may be "0.1.0", "0.1.1", etc.
 * It will always be the highest patch version that is currently available.
 * @param packageName the package you want the highest patch version to
 * @param majorMinor the major.minor version that you want to get the highest patch version of
 */
export async function getHighestPatchVersion(packageName: string, majorMinor: string): Promise<string | null> {
    const allVersions = await getPackageVersions(packageName);
    return semver.maxSatisfying(allVersions, "~" + majorMinor);
}

/**
 * Builds the tarball download url of the passed package for the official npm registry,
 * @param pkg the package to which you need the download url to
 * @returns the download url for this package
 */
function buildNpmPackageURL(pkg: NpmPackage): string {
    return `${npmRegistryEndpoint}${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
}

/**
 * Builds the path where this package should be installed to.
 */
export function buildNpmPackagePath(nodecgIODir: string, pkg: NpmPackage): string {
    return path.join(nodecgIODir, pkg.path);
}

/**
 * Creates a read stream that will be fed the tarball of the passed package directly from the official npm registry.
 * @param pkg the package to fetch
 */
export async function createNpmPackageReadStream(pkg: NpmPackage): Promise<fs.ReadStream> {
    const response = await axios({
        url: buildNpmPackageURL(pkg),
        method: "GET",
        responseType: "stream",
    });

    return response.data;
}

/**
 * Extracts the tarball of a npm package that needs to be provided using a stream.
 * @param pkg the package which you want to be extracted (used for path)
 * @param tarStream the stream of the tar file you get by {@link createNpmPackageReadStream}
 * @param nodecgIODir the nodecg-io directory
 */
export async function extractNpmPackageTar(
    pkg: NpmPackage,
    tarStream: fs.ReadStream,
    nodecgIODir: string,
): Promise<void> {
    const extractStream = tarStream.pipe(gunzip(3)).pipe(
        tar.extract(buildNpmPackagePath(nodecgIODir, pkg), {
            map: (header) => {
                // Content inside the tar is in /package/*, so we need to rewrite the name to not create a directory
                // named package in each downloaded package directory.
                if (header.name.startsWith("package/")) {
                    header.name = path.relative("package/", header.name);
                }

                return header;
            },
        }),
    );

    await new Promise((res) => extractStream.on("finish", res));
}

/**
 * Fetches and extracts a single package from the official npm registry.
 * @param pkg the package to download
 * @param nodecgIODir the root directory in which the package with the package path will be fetched into
 */
export async function downloadNpmPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarStream = await createNpmPackageReadStream(pkg);
    await extractNpmPackageTar(pkg, tarStream, nodecgIODir);
}

/**
 * Installs npm production dependencies in the passed path by running npm install --prod in the directory.
 * @param path the path where a package.json is present
 */
export async function runNpmInstall(path: string): Promise<void> {
    await executeCommand("npm", ["install", "--prod"], path);
}

/**
 * Removes a npm package by deleting its directory.
 * @param pkg the package to remove
 * @param nodecgIODir the directory in which nodecg-io is installed
 */
export async function removeNpmPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    await removeDirectory(buildNpmPackagePath(nodecgIODir, pkg));
}

/**
 * Gets version of the installed npm by running "npm --version".
 * @returns the npm version or undefined if npm is not installed/not in $PATH.
 */
export function getNpmVersion(): Promise<semver.SemVer | undefined> {
    return new Promise((resolve, reject) => {
        const child = exec("npm --version", (err, stdout) => {
            if (err) {
                // not found
                // is 127 on unix-like systems and it is exit code 1 on windows
                if (child.exitCode === 127 || child.exitCode === 1) {
                    resolve(undefined);
                } else {
                    reject(err);
                }
            } else {
                const ver = new semver.SemVer(stdout);
                resolve(ver);
            }
        });
    });
}

/**
 * Ensures that there is a npm installation in the current $PATH and it is npm version 7 or higher
 * because thats required for nodecg-io prod (workspaces) and dev (lockfile v2).
 */
export async function requireNpmV7(): Promise<void> {
    const version = await getNpmVersion();
    if (!version) {
        throw new Error("Could not find npm. Make sure npm is installed and in your $PATH.");
    }

    if (!semver.satisfies(version, ">=7")) {
        throw new Error(
            `The nodecg-io cli requires a npm version of 7.0.0 or higher. You have ${version.version}.` +
                '\nUpdate npm by running "npm install -g npm".',
        );
    }
}
