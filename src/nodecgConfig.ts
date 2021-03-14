import * as path from "path";
import * as fs from "fs/promises";

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
async function readNodeCGConfig(nodecgDir: string): Promise<NodeCGConfig | undefined> {
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
async function writeNodeCGConfig(nodecgDir: string, config: NodeCGConfig): Promise<void> {
    // Ensure that cfg directory exists
    const cfgPath = path.join(nodecgDir, cfgDir);
    try {
        await fs.access(cfgPath);
    } catch (_e) {
        // failed to get file => doesn't exist yet.
        await fs.mkdir(cfgPath);
    }

    const content = JSON.stringify(config, null, 4);
    await fs.writeFile(buildConfigPath(nodecgDir), content);
}

/**
 * Ensures that the given bundle directory is contained in the nodecg config of the passed dir.
 * If it is not already in the config it will be added.
 * @param nodecgDir the directory of the nodecg installation.
 * @param bundleDir the bundle dir which should be added to the config, if it isn't already.
 */
export async function ensureConfigContainsBundleDir(nodecgDir: string, bundleDir: string): Promise<void> {
    const config = (await readNodeCGConfig(nodecgDir)) ?? {};
    if (!config.bundles) {
        config.bundles = {};
    }

    const paths = config.bundles.paths ?? [];
    if (paths.includes(bundleDir)) {
        return; // Bundle dir is already included in the config, we don't need to add it.
    }

    config.bundles.paths = paths.concat(bundleDir);
    await writeNodeCGConfig(nodecgDir, config);
    console.log(`Added bundle dir "${bundleDir}" to your nodecg config.`);
}
