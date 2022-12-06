import * as path from "path";
import { promises as fs } from "fs";
import { logger } from "./log.js";
import { directoryExists } from "./fs.js";

/**
 * A configuration of nodecg according to https://www.nodecg.dev/docs/nodecg-configuration/
 * (only fields that we need in this cli are listed here, if we need more in the future, we can add them here.)
 */
interface NodeCGConfig {
    bundles?: {
        paths?: string[];
    };
}

const cfgDir = "cfg";
const cfgName = "nodecg.json";

function buildConfigPath(nodecgDir: string): string {
    return path.join(nodecgDir, cfgDir, cfgName);
}

/**
 * Reads the {@link NodeCGConfig} of the nodecg installation in the given directory.
 * @param nodecgDir the directory in which the nodecg installation resides.
 * @returns a config if the file exists and is valid. undefined otherwise
 */
export async function readNodeCGConfig(nodecgDir: string): Promise<NodeCGConfig | undefined> {
    try {
        const buf = await fs.readFile(buildConfigPath(nodecgDir));
        const str = buf.toString();
        return JSON.parse(str);
    } catch (_e) {
        return undefined;
    }
}

/**
 * Writes a {@link NodeCGConfig} to the config directory of a nodecg installation.
 * @param nodecgDir the directory in which the nodecg installation resides.
 * @param config the config that should be written.
 */
export async function writeNodeCGConfig(nodecgDir: string, config: NodeCGConfig): Promise<void> {
    // Ensure that cfg directory exists
    const cfgPath = path.join(nodecgDir, cfgDir);
    if (!(await directoryExists(cfgPath))) {
        await fs.mkdir(cfgPath);
    }

    const content = JSON.stringify(config, null, 4);
    await fs.writeFile(buildConfigPath(nodecgDir), content);
}

/**
 * Ensures that the given bundle directory is contained depending on the include parameter in the nodecg config of the passed dir.
 * If include is true and the directory is not in the config it will be added.
 * If include is false and the directory is in the config it will be removed.
 * Otherwise nothing happens.
 * @param nodecgDir the directory of the nodecg installation.
 * @param bundleDir the bundle dir which should be added/removed from the config, if it isn't already.
 * @param include whether the bundle should be in the config or not after executing this function.
 */
export async function manageBundleDir(nodecgDir: string, bundleDir: string, include: boolean): Promise<void> {
    const config = (await readNodeCGConfig(nodecgDir)) ?? {};
    if (!config.bundles) {
        config.bundles = {};
    }

    const paths = config.bundles.paths ?? [];
    if (include === paths.includes(bundleDir)) {
        return; // Bundle dir is already in wanted state. (included if we want to include it or excluded if we want to exclude it).
    }

    if (include) {
        config.bundles.paths = paths.concat(bundleDir);
    } else {
        config.bundles.paths = paths.filter((d) => d !== bundleDir);
    }
    await writeNodeCGConfig(nodecgDir, config);

    if (include) {
        logger.debug(`Added bundle dir "${bundleDir}" to your nodecg config.`);
    } else {
        logger.debug(`Removed bundle dir "${bundleDir}" from your nodecg config.`);
    }
}
