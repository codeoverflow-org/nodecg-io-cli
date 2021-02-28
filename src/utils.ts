import * as fs from "fs/promises";
import PasswordPrompt = require("inquirer/lib/prompts/password");
import * as path from "path";
import * as findUp from "find-up"

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(): Promise<string | undefined> {
    return await findUp(async (dir) => (await isNodeCGDirectory(dir)) ? dir : undefined, {type: "directory"})
}

/**
 * Checks whether a nodecg installation is in the passed directory.
 * It currently does this by checking for a package.json which must contain the name "nodecg"
 * @param dir the directory which may contain the nodecg installation
 */
async function isNodeCGDirectory(dir: string): Promise<boolean> {
    const packageJsonPath = path.join(dir, "package.json");
    
    try {
        await fs.access(packageJsonPath); // no exception => accessable
    } catch (err) {
        return false; // User can't access this file/directory
    }

    const data = await fs.readFile(packageJsonPath);
    const json = JSON.parse(data.toString());
    const packageName = json["name"];
    return packageName === "nodecg";
}