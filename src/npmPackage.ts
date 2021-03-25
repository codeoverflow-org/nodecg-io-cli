import axios from "axios";
import * as semver from "semver";
import * as fs from "fs";
import * as path from "path";
import gunzip = require("gunzip-maybe");
import tar = require("tar-fs");
import { executeCommand } from "./utils";

const npmRegistryEndpoint = "https://registry.npmjs.org/";

export interface NpmPackage {
    name: string;
    path: string;
    version: string;
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

function buildNpmPackageURL(pkg: NpmPackage): string {
    return `${npmRegistryEndpoint}${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
}

/**
 * Creates a read stream that will be fed the tarball of the passed package directly from the official npm registry.
 * @param pkg the package to fetch
 */
export async function createNpmPackageReadStream(pkg: NpmPackage): Promise<fs.ReadStream> {
    // TODO: properly handle npm server failures
    const response = await axios({
        url: buildNpmPackageURL(pkg),
        method: "GET",
        responseType: "stream",
    });

    return response.data;
}

export async function extractNpmPackageTar(
    pkg: NpmPackage,
    tarStream: fs.ReadStream,
    nodecgIODir: string,
): Promise<void> {
    const extractStream = tarStream.pipe(gunzip()).pipe(
        tar.extract(path.join(nodecgIODir, pkg.path), {
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

export async function installNpmDependencies(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    // TODO: handle when npm is not installed.
    await executeCommand("npm", ["install", "--prod"], false, path.join(nodecgIODir, pkg.path));
}
