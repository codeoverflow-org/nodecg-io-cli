import { Installation } from "../utils/installation";
import * as inquirer from "inquirer";
import { getHighestPatchVersion, getMinorVersions, NpmPackage } from "../utils/npm";
import * as semver from "semver";
import { logger } from "../utils/log";
import {
    corePackage,
    corePackages,
    dashboardPackage,
    dashboardPath,
    developmentVersion,
    getServicesForVersion,
    supportedNodeCGIORange,
} from "../nodecgIOVersions";

interface PromptInput {
    version: string;
    useSamples?: boolean;
    cloneDocs?: boolean;
    services?: string[];
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

    const currentProd = currentInstall !== undefined && !currentInstall.dev ? currentInstall : undefined;
    const currentDev = currentInstall !== undefined && currentInstall.dev ? currentInstall : undefined;

    const promptInput = await inquirer.prompt([
        {
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: [...versions, developmentVersion].reverse(),
            loop: false,
            default: currentInstall?.version ?? versions[versions.length - 1],
        },
        // Options for development installs
        {
            type: "confirm",
            name: "useSamples",
            message: "Would you like to use the provided samples?",
            when: (x: PromptInput) => x.version === developmentVersion,
            default: currentDev?.useSamples ?? false,
        },
        {
            type: "confirm",
            name: "cloneDocs",
            message: "Would you like to clone the documentation?",
            when: (x: PromptInput) => x.version === developmentVersion,
            default: currentDev?.cloneDocs ?? true,
        },
        // Options for production installs
        {
            type: "checkbox",
            name: "services",
            message: "Which services do you want to use?",
            choices: (x: PromptInput) => getServicesForVersion(x.version),
            when: (x: PromptInput) => x.version !== developmentVersion,
            default: (x: PromptInput) => {
                if (!currentProd) return;
                return getServicesFromInstall(currentProd.packages, x.version);
            },
        },
    ]);

    return await processPromptInput(promptInput);
}

export async function processPromptInput(input: PromptInput): Promise<Installation> {
    if (input.version === developmentVersion) {
        return {
            version: input.version,
            dev: true,
            useSamples: input.useSamples ?? false,
            cloneDocs: input.cloneDocs ?? false,
        };
    } else {
        return {
            version: input.version,
            dev: false,
            packages: await buildPackageList(input.version, input.services ?? []),
        };
    }
}

/**
 * Gets all nodecg-io minor versions and checks which are compatible with this cli version (major.minor equals or less).
 * @returns compatible versions of nodecg-io
 */
export async function getCompatibleVersions(includeRange: semver.Range = supportedNodeCGIORange): Promise<string[]> {
    const all = await getMinorVersions(corePackage);
    const notCompatibleVersions: string[] = [];

    const filtered = all.filter((v) => {
        if (semver.satisfies(`${v}.0`, includeRange)) {
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
export async function buildPackageList(version: string, services: string[]): Promise<NpmPackage[]> {
    const servicePackageNames = services.map((name) => `nodecg-io-${name}`);
    const packageNames = corePackages.concat(servicePackageNames);

    const resolvePromises = packageNames.map(async (pkgName) => ({
        name: pkgName,
        path: getPackagePath(pkgName),
        version: await getPackageVersion(pkgName, version),
        symlink: getPackageSymlinks(version, pkgName),
    }));

    return await Promise.all(resolvePromises);
}

function getPackagePath(pkgName: string) {
    // Special case: dashboard needs to be in nodecg-io-core/dashboard
    if (pkgName === dashboardPackage) {
        return dashboardPath;
    }

    // Normal case: package should go in directory named after the package
    // this includes all services.
    return pkgName;
}

async function getPackageVersion(pkgName: string, minorVersion: string) {
    const version = await getHighestPatchVersion(pkgName, minorVersion);
    // if patch part could be found out we will use .0 as it should always exist if the minor version also does.
    return version?.version ?? `${minorVersion}.0`;
}

function getPackageSymlinks(version: string, pkgName: string) {
    // special case: dashboard of version 0.1 needs monaco-editor to be symlink into the local node_modules directory.
    // with 0.2 and onwards monaco-editor is built with webpack and included in the build output.
    if (pkgName === dashboardPackage && version === "0.1") {
        return ["monaco-editor"];
    }

    // normal case: usually we don't need symlinks because node walks up the fs to find the hoisted node_modules directory.
    return undefined;
}

/**
 * Returns the list of installed services of a production installation.
 * @param install the installation info for which you want the list of installed services.
 * @param targetVersion the version of nodecg-io that is installed
 * @returns the list of installed services (package names without the nodecg-io- prefix)
 */
export function getServicesFromInstall(installedPackages: NpmPackage[], targetVersion: string): string[] {
    const availableServices = getServicesForVersion(targetVersion);

    const svcPackages = installedPackages
        // Exclude core packages, they are not a optional service, they are always required
        .filter((pkg) => !corePackages.find((corePkg) => pkg.name === corePkg))
        .map((pkg) => pkg.name.replace("nodecg-io-", ""))
        // Filter out services that aren't available in this version. The install might be of a higher version where this service is available
        .filter((pkgName) => availableServices.includes(pkgName));

    return svcPackages ?? [];
}
