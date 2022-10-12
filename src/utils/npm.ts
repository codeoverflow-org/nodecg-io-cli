import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import * as fs from "fs";
import * as path from "path";
import { executeCommand } from "./fs";
import { exec } from "child_process";
import { maxSatisfying, satisfies, SemVer } from "semver";
import * as zlib from "zlib";
import * as tar from "tar-fs";

const npmRegistryEndpoint = "https://registry.npmjs.org/";
const nodeModulesDir = "node_modules";

// Only gets abbreviated metadata as described in https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
const axiosNpmMetadataConfig: AxiosRequestConfig = {
    headers: {
        // Includes fallback to full json, just in case the npm registry malfunctions or this is removed for some reason
        Accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
    },
};

/**
 * Information about a npm package that will be fetched by a prod install with name, installed version
 * and the path where the package should be installed.
 */
export interface NpmPackage {
    name: string;
    path: string;
    version: string;
    /**
     * Some package require a direct link to another package in their node_modules directory because
     * e.g. they are getting it through a direct path and don't use the node module resolution algorithm
     * which allows hoisting packages. In this case for each package in the symlink array there will be a
     * symlink in the local node_modules pointing to the hoisted version of these packages.
     */
    symlink?: string[];
}

/**
 * Checks whether two {@link NpmPackage} are the complete same package. Meaning every field has to be the same for this to return true.
 * @returns
 */
export function isPackageEquals(a: NpmPackage, b: NpmPackage): boolean {
    const symlinkEq = a.symlink?.every((elem, idx) => b.symlink?.[idx] === elem) ?? a.symlink === b.symlink;
    return a.name === b.name && a.path === b.path && a.version === b.version && symlinkEq;
}

/**
 * Gets all version for the passed package that are available at the official npm registry.
 * @param packageName which package you want the versions to.
 * @returns the versions of the package
 */
export async function getPackageVersions(packageName: string): Promise<SemVer[]> {
    const response = (await axios(npmRegistryEndpoint + packageName, axiosNpmMetadataConfig)) as AxiosResponse<{
        versions?: Record<string, never>;
    }>;
    if (response.data.versions) {
        return Object.keys(response.data.versions).map((versionString) => new SemVer(versionString));
    } else {
        // Version field is missing when e.g. the package has been fully unpublished
        // see https://www.npmjs.com/policies/unpublish for further details.
        throw new Error("package has no published versions.");
    }
}

/**
 * Returns the latest published version for the package with the passed name.
 * @param packageName the package for which you want to get the latest published version.
 * @return the latest version if the package was found and null if the package was not found on the npm registry.
 */
export async function getLatestPackageVersion(packageName: string): Promise<SemVer> {
    const response = await axios(npmRegistryEndpoint + packageName, axiosNpmMetadataConfig);

    // Gets version through npm tag "latest" so we don't use any pre-release or beta versions
    const latest = response.data["dist-tags"]["latest"];
    if (!latest) {
        throw new Error(`Metadata response for ${packageName} does not contain a latest dist-tag.`);
    }

    return new SemVer(latest);
}

/**
 * Gets all the minor versions of this package that are available at the official npm registry.
 * This means all patch versions are filtered out and you only get "major.minor" back.
 * @param packageName which packages you want the minor/major versions to.
 * @returns the minor versions of the package
 */
export async function getMinorVersions(packageName: string): Promise<string[]> {
    const allVersions = await getPackageVersions(packageName);
    const majorMinorVersions = allVersions.map((version) => `${version.major}.${version.minor}`);
    return [...new Set(majorMinorVersions)];
}

/**
 * Gets the highest patch version of the passed package and the passed major.minor version.
 * E.g. if majorMinor is "0.1" it may be "0.1.0", "0.1.1", etc.
 * It will always be the highest patch version that is currently available.
 * @param packageName the package you want the highest patch version to
 * @param majorMinor the major.minor version that you want to get the highest patch version of
 */
export async function getHighestPatchVersion(packageName: string, majorMinor: string): Promise<SemVer | null> {
    const allVersions = await getPackageVersions(packageName);
    return maxSatisfying(allVersions, "~" + majorMinor);
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
export function buildNpmPackagePath(pkg: NpmPackage, nodecgIODir: string): string {
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
    const extractStream = tarStream.pipe(zlib.createGunzip({ level: 3 })).pipe(
        tar.extract(buildNpmPackagePath(pkg, nodecgIODir), {
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
 * Installs npm production dependencies in the passed path by running npm install --omit=dev in the directory.
 * @param path the path where a package.json is present
 * @param onlyProd whether to only install production dependencies or also devDependencies.
 */
export async function runNpmInstall(path: string, onlyProd: boolean): Promise<void> {
    const prodArg = onlyProd ? ["--omit=dev"] : [];
    await executeCommand("npm", ["install", ...prodArg], path);
}

/**
 * Compiles the TypeScript code of a package by running executing the npm script called "build".
 * @param path the path in which the package is located.
 * @param args additional arguments that are passed to npm.
 */
export async function runNpmBuild(path: string, ...args: string[]): Promise<void> {
    await executeCommand("npm", ["run", "build", ...args], path);
}

/**
 * Creates symlinks for packages that cannot be hoisted and must be in the local node_modules directory.
 * Refer to NpmPackage.symlink for further information.
 * @param packages the packages which you have installed and where the symlinks should be created.
 * @param nodecgIODir the root directory which also includes a node_modules directory with the hoisted packages.
 */
export async function createNpmSymlinks(packages: NpmPackage[], nodecgIODir: string): Promise<void> {
    const linkPromises = packages
        .map((pkg) => {
            // We don't need any symlinks and can them for this package
            if (!pkg.symlink) return [];

            return pkg.symlink.map(async (linkPkg) => {
                const pkgNodeModules = path.join(buildNpmPackagePath(pkg, nodecgIODir), nodeModulesDir);
                await fs.promises.mkdir(pkgNodeModules);

                const linkModulePath = path.join(pkgNodeModules, linkPkg);
                const hoistedPath = path.join(nodecgIODir, nodeModulesDir, linkPkg);

                await fs.promises.symlink(hoistedPath, linkModulePath, "junction");
            });
        })
        .flat();

    await Promise.all(linkPromises);
}

/**
 * Removes a npm package by deleting its directory.
 * @param pkg the package to remove
 * @param nodecgIODir the directory in which nodecg-io is installed
 */
export async function removeNpmPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    await fs.promises.rm(buildNpmPackagePath(pkg, nodecgIODir), { recursive: true, force: true });
}

/**
 * Returns you all packages that are in a sub-path of rootPkg.
 * This is helpful if you have reinstalled rootPkg and now also need to reinstall all packages
 * that were in the directory of rootPkg because they also got removed in {@link removeNpmPackage}.
 * @returns the packages that are contained in rootPkg
 */
export function getSubPackages(allPackages: NpmPackage[], rootPkg: NpmPackage): NpmPackage[] {
    return allPackages.filter((pkg) => pkg !== rootPkg && pkg.path.startsWith(rootPkg.path));
}

/**
 * Recursively finds npm packages using {@link findNpmPackages} in the given directory.
 */
export async function findNpmPackages(basePath: string): Promise<NpmPackage[]> {
    // If there is a package in this directory, get it
    const pkg = await getNpmPackageFromPath(basePath);

    // Enumerate sub directories and get any packages in these too
    const subDirs = await fs.promises.readdir(basePath, { withFileTypes: true });
    const subPackages = await Promise.all(
        subDirs
            .filter((f) => f.isDirectory())
            .map((f) => f.name)
            .filter((dir) => dir !== "node_modules") // dependencies, not interesting to us. Also waaaay to big to check, lol
            .map((subDir) => findNpmPackages(path.join(basePath, subDir))),
    );

    return [pkg, ...subPackages.flat()].filter((p): p is NpmPackage => p !== undefined);
}

/**
 * Gets the npm package that is located in the directory of the passed path.
 * @param basePath the root directory of the package where the package.json resides in
 * @returns if a package.json was found and the package is public, the npm package. Otherwise undefined
 */
async function getNpmPackageFromPath(basePath: string): Promise<NpmPackage | undefined> {
    const packageJsonPath = `${basePath}/package.json`;
    try {
        const packageJson = await fs.promises.readFile(packageJsonPath, "utf8");
        const pkg = JSON.parse(packageJson);
        if (pkg.private) return undefined;

        return {
            name: pkg.name,
            version: pkg.version,
            path: basePath,
        };
    } catch (e) {
        return undefined;
    }
}

/**
 * Gets version of the installed npm by running "npm --version".
 * @returns the npm version or undefined if npm is not installed/not in $PATH.
 */
export function getNpmVersion(): Promise<SemVer | undefined> {
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
                const ver = new SemVer(stdout);
                resolve(ver);
            }
        });
    });
}

/**
 * Ensures that there is a npm installation in the current $PATH and it is npm version 7 or higher
 * because that's required for nodecg-io prod (workspaces) and dev (lockfile v2).
 */
export async function requireNpmV7(): Promise<void> {
    const version = await getNpmVersion();
    if (!version) {
        throw new Error("Could not find npm. Make sure npm is installed and in your $PATH.");
    }

    if (!satisfies(version, ">=7")) {
        throw new Error(
            `The nodecg-io cli requires a npm version of 7.0.0 or higher. You have ${version.version}.` +
                '\nUpdate npm by running "npm install -g npm".',
        );
    }
}
