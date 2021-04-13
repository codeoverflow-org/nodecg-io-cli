import { Installation, ProductionInstallation } from "../installation";
import * as inquirer from "inquirer";
import { getHighestPatchVersion, getMinorVersions, NpmPackage } from "../npm";
import * as semver from "semver";
import { logger } from "../log";
import {
    corePackage,
    corePackages,
    dashboardPackage,
    developmentVersion,
    getServicesForVersion,
    supportedNodeCGIORange,
} from "./nodecgIOVersions";

interface PromptVersionInput {
    version: string;
}

/**
 * Prompts the user for installation details, e.g. which version, which services.
 * Uses the passed installation as a default so a user can edit a installation by editing the things
 * he wants different and leaving them as is to not change anything.
 * @param currentInstall the current install that will be used for default values
 * @returns the requested installation
 */
export async function promptForInstallInfo(currentInstall: Installation | undefined): Promise<Installation> {
    const versions = await getCompatibleVersions();

    const res = await inquirer.prompt([
        {
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: [...versions, developmentVersion].reverse(),
            loop: false,
            default: currentInstall?.version ?? versions.slice(-1)[0],
        },
        {
            type: "confirm",
            name: "useSamples",
            message: "Would you like to use the provided samples?",
            when: (x: PromptVersionInput) => x.version === developmentVersion,
            default: currentInstall !== undefined && currentInstall.dev && currentInstall.useSamples,
        },
        {
            type: "checkbox",
            name: "services",
            message: "Which services do you want to use?",
            choices: (x: PromptVersionInput) => getServicesForVersion(x.version),
            when: (x: PromptVersionInput) => x.version !== developmentVersion,
            default: (x: PromptVersionInput) => {
                if (!currentInstall || currentInstall?.dev) return;
                return getServicesFromInstall(currentInstall, x.version);
            },
        },
    ]);

    if (res.version === developmentVersion) {
        return { ...res, dev: true };
    } else {
        return { ...res, dev: false, packages: await buildPackageList(res.version, res.services), services: undefined };
    }
}

/**
 * Gets all nodecg-io minor versions and checks which are compatible with this cli version (major.minor equals or less).
 * @returns compatible versions of nodecg-io
 */
async function getCompatibleVersions(): Promise<string[]> {
    const all = await getMinorVersions(corePackage);
    const notCompatibleVersions: string[] = [];

    const filtered = all.filter((v) => {
        if (semver.satisfies(`${v}.0`, supportedNodeCGIORange)) {
            return true;
        } else {
            notCompatibleVersions.push(v);
            return false;
        }
    });

    if (notCompatibleVersions.length) {
        const versionList = notCompatibleVersions.join(", ");
        logger.warn(`Cannot install the following versions because the cli doesn't support them yet: ${versionList}`);
        logger.warn('Update the nodecg-io-cli by running "npm install -g nodecg-io-cli".');
    }
    return filtered;
}

/**
 * Builds a list of {@link NpmPackage}s for the passed nodecg-io version and services.
 * This list includes mandatory packages like core and dashboard.
 * @param version the version of nodecg-io for which you want the package details
 * @param services the service you want
 * @returns resolved packages with the most up to date patch version.
 */
async function buildPackageList(version: string, services: string[]): Promise<NpmPackage[]> {
    const promises = [...corePackages, ...services.map((name) => `nodecg-io-${name}`)].map(async (pkgName) => ({
        name: pkgName,
        simpleName: pkgName.replace("nodecg-io-", ""),
        path: pkgName === dashboardPackage ? `${corePackage}/dashboard` : pkgName,
        version: (await getHighestPatchVersion(pkgName, version)) ?? `${version}.0`,
    }));

    return await Promise.all(promises);
}

/**
 * Returns the list of installed services of a production installation.
 * @param install the installation info for which you want the list of installed services.
 * @param targetVersion the version of nodecg-io that is installed
 * @returns the list of installed services (simpleName of the packages without the nodecg-io- prefix)
 */
function getServicesFromInstall(install: ProductionInstallation, targetVersion: string): string[] {
    const availableServices = getServicesForVersion(targetVersion);

    const svcPackages = install?.packages
        // Exclude core packages, they are not a optional service, they are always required
        .filter((pkg) => !corePackages.find((corePkg) => pkg.name === corePkg))
        // Filter out services that aren't available in this version. The install might be of a higher version where this service is available
        .filter((pkg) => availableServices.includes(pkg.simpleName));

    // simpleName = service name.
    return svcPackages?.map((pkg) => pkg.simpleName) ?? [];
}
