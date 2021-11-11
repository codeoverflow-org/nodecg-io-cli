import { GenerationOptions } from "./prompt";
import { logger } from "../utils/log";
import { getLatestPackageVersion } from "../utils/npm";
import { genNodeCGDashboardConfig, genNodeCGGraphicConfig } from "./panel";
import { SemVer } from "semver";
import { writeBundleFile } from "./utils";

/**
 * A dependency on a npm package. First field is the package name and the second field is the version.
 */
type Dependency = [string, string];

/**
 * Generates the whole package.json file for the bundle.
 *
 * @param nodecgDir the directory in which nodecg is installed
 * @param opts the options that the user chose for the bundle.
 */
export async function genPackageJson(opts: GenerationOptions): Promise<void> {
    const serviceDeps: Dependency[] = opts.servicePackages.map((pkg) => [pkg.name, addSemverCaret(pkg.version)]);

    const content = {
        name: opts.bundleName,
        version: opts.version.version,
        private: true,
        nodecg: {
            compatibleRange: addSemverCaret("1.4.0"),
            bundleDependencies: Object.fromEntries(serviceDeps),
            graphics: genNodeCGGraphicConfig(opts),
            dashboardPanels: genNodeCGDashboardConfig(opts),
        },
        // These scripts are for compiling TS and thus are only needed when generating a TS bundle
        scripts: genScripts(opts),
        dependencies: Object.fromEntries(await genDependencies(opts, serviceDeps)),
    };

    await writeBundleFile(content, opts.bundlePath, "package.json");
}

/**
 * Generates the dependency field for a package.json of a bundle.
 *
 * @param opts the selected options for bundle generation
 * @param serviceDeps the dependencies on service packages
 * @param nodecgDir the directory in which nodecg is installed
 * @return the dependencies for a bundle with the given options.
 */
async function genDependencies(opts: GenerationOptions, serviceDeps: Dependency[]) {
    const core = [opts.corePackage.name, addSemverCaret(opts.corePackage.version)];

    if (opts.language === "typescript") {
        // For typescript we need core, all services (for typings) and special packages like ts itself or node typings.
        const deps = [core, ...serviceDeps, ...(await genTypeScriptDependencies())];
        deps.sort();
        return deps;
    } else {
        // For JS we only need the core for e.g. the requireService function.
        return [core];
    }
}

/**
 * Generates all extra dependencies that are needed when having a bundle in TS. Meaning typescript itself, nodecg for typings
 * and types for node.
 * @param nodecgDir the directory in which nodecg is installed. Used to get nodecg version which will be used by nodecg dependency.
 */
async function genTypeScriptDependencies(): Promise<Dependency[]> {
    logger.debug("Fetching latest nodecg-types, typescript and @types/node versions...");
    const [nodecgVersion, latestNodeTypes, latestTypeScript] = await Promise.all([
        getLatestPackageVersion("nodecg-types"),
        getLatestPackageVersion("@types/node"),
        getLatestPackageVersion("typescript"),
    ]);

    return [
        ["nodecg-types", addSemverCaret(nodecgVersion)],
        ["@types/node", addSemverCaret(latestNodeTypes)],
        ["typescript", addSemverCaret(latestTypeScript)],
    ];
}

/**
 * Generates the script field of the package.json.
 * Contains build scripts for TypeScript if it was chosen as a bundle language.
 * Will be empty for JavaScript because it doesn't need to be built.
 */
function genScripts(opts: GenerationOptions) {
    if (opts.language !== "typescript") {
        return undefined;
    }

    // Is TypeScript, thus we need the build scripts that invoke tsc
    return {
        build: "tsc -b",
        watch: "tsc -b -w",
        clean: "tsc -b --clean",
    };
}

/**
 * Adds the semver caret operator to a given version to allow or minor and patch updates by npm.
 *
 * @param version the base version
 * @return the version with the semver caret operator in front.
 */
function addSemverCaret(version: string | SemVer): string {
    return `^${version}`;
}
