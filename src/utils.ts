import * as fs from "fs/promises";
import * as path from "path";
import * as findUp from "find-up"
import { exec, spawn } from "child_process";

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(): Promise<string | undefined> {
    return await findUp(async (dir) => (await isNodeCGDirectory(dir)) ? dir : undefined, {type: "directory"})
}

/**
 * Builds the path where the nodecg-io directory should be located. It is not checked whether it exists or not!
 */
export function getNodeCGIODirectory(nodecgDir: string): string {
    return path.join(nodecgDir, "nodecg-io");
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

export function executeAndStreamOutput(command: string, args: string[], workingDir?: string): Promise<number | null> {
    console.log(`>>> ${command} ${args.join(" ")}`);

    const child = spawn(command, args, {cwd: workingDir});
    
    // Streams output to stdout/stderr of this process.
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    return new Promise((resolve, reject) => {
        child.addListener("error", (err) => reject(err));
        child.addListener("exit", (code) => {
            console.log();
            resolve(code);
        });
    })
}