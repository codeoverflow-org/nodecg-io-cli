import * as path from "path";
import * as fs from "fs";
import { SemVer } from "semver";
import { directoryExists } from "./fs";

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(dir = process.cwd()): Promise<string> {
    if (await isNodeCGDirectory(dir)) {
        return dir;
    }

    const parent = path.dirname(dir);

    // We're at the filesystem root because we cannot go one level up more and didn't found a nodecg installation
    if (parent === dir) {
        throw new Error(
            "Couldn't find a nodecg installation. Make sure that you are in the directory of your nodecg installation.",
        );
    }

    return findNodeCGDirectory(parent);
}

/**
 * Checks whether a nodecg installation is in the passed directory.
 * It currently does this by checking for a package.json which must contain the name "nodecg"
 * @param dir the directory which may contain the nodecg installation
 */
async function isNodeCGDirectory(dir: string): Promise<boolean> {
    if (!(await directoryExists(dir))) return false;

    try {
        const packageJson = await readPackageJson(dir);
        const packageName = packageJson["name"];
        return packageName === "nodecg";
    } catch (_e) {
        return false; // package.json is probably not existent
    }
}

/**
 * Gets the version of a nodecg installation by reading the version field in the package.json file.
 * @param nodecgDir the directory in which nodecg is located.
 * @returns the version of the nodecg installation
 */
export async function getNodeCGVersion(nodecgDir: string): Promise<SemVer> {
    const packageJson = await readPackageJson(nodecgDir);
    const version = packageJson["version"];
    if (version === undefined) {
        throw new Error("Version field is missin in the NodeCG package.json.");
    }

    return new SemVer(version);
}

async function readPackageJson(nodecgDir: string): Promise<Record<string, string>> {
    const packageJsonPath = path.join(nodecgDir, "package.json");
    const data = await fs.promises.readFile(packageJsonPath);
    return JSON.parse(data.toString());
}

/**
 * Builds the path where the nodecg-io directory should be located. It is not checked whether it exists or not!
 */
export function getNodeCGIODirectory(nodecgDir: string): string {
    return path.join(nodecgDir, "nodecg-io");
}
