import { promises as fs } from "fs";
import * as path from "path";
import { NpmPackage } from "./npm";

/**
 * Information about a install of nodecg-io. Includes things like version, etc.
 */
export type Installation = DevelopmentInstallation | ProductionInstallation;

/**
 * A develop version of nodecg-io that is cloned directly form the git repository.
 * This is the current WIP everything may break version.
 */
export interface DevelopmentInstallation {
    dev: true;
    version: "development";
    useSamples: boolean;
    commitHash?: string;
}

/**
 * A production install using released tarballs of the packages from npm.
 * This is a version from a release.
 */
export interface ProductionInstallation {
    dev: false;
    version: string;
    packages: NpmPackage[];
}

function buildInstallJsonPath(nodecgIODir: string) {
    return path.join(nodecgIODir, "install.json");
}

/**
 * Reads the information about a nodecg-io installation, which is located in the install.json inside the nodecg-io directory.
 * @param nodecgIODir the directory in which nodecg-io is installed.
 * @returns a {@link Installation} if a install.json was found, undefined otherwise.
 */
export async function readInstallInfo(nodecgIODir: string): Promise<Installation | undefined> {
    try {
        const content = await fs.readFile(buildInstallJsonPath(nodecgIODir));
        return JSON.parse(content.toString());
    } catch (_e) {
        return undefined;
    }
}

/**
 * Updates/Writes the passed install info to disk.
 * @param nodecgIODir the installation directory of nodecg-io.
 * @param install the installation info which should be written.
 */
export async function writeInstallInfo(nodecgIODir: string, install: Installation): Promise<void> {
    const content = JSON.stringify(install, null, 4);
    await fs.writeFile(buildInstallJsonPath(nodecgIODir), content);
}
