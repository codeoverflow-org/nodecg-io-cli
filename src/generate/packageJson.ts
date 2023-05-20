import { GenerationOptions } from "./prompt.js";
import { logger } from "../utils/log.js";
import { getLatestPackageVersion } from "../utils/npm.js";
import { genNodeCGDashboardConfig, genNodeCGGraphicConfig } from "./panel.js";
import { SemVer } from "semver";
import { writeBundleFile } from "./utils.js";
import { Installation } from "../utils/installation.js";

// Loaction where the development tarballs are hosted.
export const developmentPublishRootUrl = "https://codeoverflow-org.github.io/nodecg-io-publish/";

/**
 * A dependency on a npm package. First field is the package name and the second field is the version.
 */
type Dependency = [string, string];

/**
 * Generates the whole package.json file for the bundle.
 *
 * @param opts the options that the user chose for the bundle.
 * @param install the nodecg-io installation that will used to get the versions of the various packages.
 */
export async function genPackageJson(opts: GenerationOptions, install: Installation): Promise<void> {
    const serviceDeps = opts.servicePackages.map((pkg) => getNodecgIODependency(pkg.name, pkg.version, install));

    const content = {
        name: opts.bundleName,
        version: opts.version.version,
        private: true,
        nodecg: {
            compatibleRange: "^1.4.0",
            bundleDependencies: Object.fromEntries(opts.servicePackages.map((pkg) => [pkg.name, `^${pkg.version}`])),
            graphics: genNodeCGGraphicConfig(opts),
            dashboardPanels: genNodeCGDashboardConfig(opts),
        },
        // These scripts are for compiling TS and thus are only needed when generating a TS bundle
        scripts: genScripts(opts),
        dependencies: Object.fromEntries(await genDependencies(opts, serviceDeps, install)),
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
async function genDependencies(opts: GenerationOptions, serviceDeps: Dependency[], install: Installation) {
    const core = getNodecgIODependency(opts.corePackage.name, opts.corePackage.version, install);

    if (opts.language === "typescript") {
        // For typescript we need core, all services (for typings) and special packages like ts itself or node typings.
        const deps = [core, ...serviceDeps, ...(await genTypeScriptDependencies(opts))];
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
async function genTypeScriptDependencies(opts: GenerationOptions): Promise<Dependency[]> {
    logger.debug(
        `Fetching latest ${opts.nodeCGTypingsPackage}, nodecg-io-tsconfig, typescript and @types/node versions...`,
    );
    const [nodecgVersion, latestTsConfig, latestTypeScript, latestNodeTypes] = await Promise.all([
        getLatestPackageVersion(opts.nodeCGTypingsPackage),
        getLatestPackageVersion("nodecg-io-tsconfig"),
        getLatestPackageVersion("typescript"),
        getLatestPackageVersion("@types/node"),
    ]);

    return [
        ["@types/node", `^${latestNodeTypes}`],
        [opts.nodeCGTypingsPackage, `^${nodecgVersion}`],
        ["nodecg-io-tsconfig", `^${latestTsConfig}`],
        ["typescript", `^${latestTypeScript}`],
    ];
}

/**
 * Generates the script field of the package.json.
 * Contains build scripts for TypeScript if it was chosen as a bundle language.
 * Will be empty for JavaScript because it doesn't need to be built.
 */
function genScripts(opts: GenerationOptions) {
    if (opts.language !== "typescript") {
        // For JS we don't need any scripts to build anything.
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
 * Builds the npm dependency for the package with the passed name and version.
 * If this is a production install it will be from the npm registry and
 * if it is a development install it will be from a tarball of the nodecg-io-publish repository.
 */
function getNodecgIODependency(packageName: string, version: string | SemVer, install: Installation): Dependency {
    if (install.dev) {
        return [packageName, `${developmentPublishRootUrl}${packageName}-${version}.tgz`];
    } else {
        return [packageName, `^${version}`];
    }
}
