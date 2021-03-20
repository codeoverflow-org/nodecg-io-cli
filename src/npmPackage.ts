import axios from "axios";
import * as semver from "semver";
import * as fs from "fs";

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
 * Fetches the tarball of the passed package to the passed destination.
 * @param pkg the package to fetch
 * @param targetFile where the tarball of the pckage should be downloaded
 */
export async function fetchNpmPackage(pkg: NpmPackage, targetFile: fs.PathLike): Promise<void> {
    // TODO: properly handle npm server failures
    const response = await axios({
        url: buildNpmPackageURL(pkg),
        method: "GET",
        responseType: "stream",
    });

    // Stream response to fs which will write it to disk.
    const writer = fs.createWriteStream(targetFile);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        response.data.on("end", resolve);
        response.data.on("error", reject);
    });
    writer.close();
}
