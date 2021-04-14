import { promises as fs } from "fs";
import * as path from "path";
import * as findUp from "find-up";
import { spawn } from "child_process";
import { logger } from "./log";

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(): Promise<string> {
    const res = await findUp(async (dir) => ((await isNodeCGDirectory(dir)) ? dir : undefined), { type: "directory" });
    if (res === undefined) {
        throw new Error(
            "Couldn't find a nodecg installation. Make sure that you are in the directory of your nodecg installation.",
        );
    }
    return res;
}

/**
 * Checks whether a nodecg installation is in the passed directory.
 * It currently does this by checking for a package.json which must contain the name "nodecg"
 * @param dir the directory which may contain the nodecg installation
 */
async function isNodeCGDirectory(dir: string): Promise<boolean> {
    if ((await directoryExists(dir)) === false) return false;

    try {
        const packageJsonPath = path.join(dir, "package.json");
        const data = await fs.readFile(packageJsonPath);
        const json = JSON.parse(data.toString());
        const packageName = json["name"];
        return packageName === "nodecg";
    } catch (_e) {
        return false; // package.json is probably not existent
    }
}

/**
 * Builds the path where the nodecg-io directory should be located. It is not checked whether it exists or not!
 */
export function getNodeCGIODirectory(nodecgDir: string): string {
    return path.join(nodecgDir, "nodecg-io");
}

/**
 * Checks whether the specified directory exists or not.
 * @param dir the directory to check
 * @returns whether the directory exists or not
 */
export async function directoryExists(dir: string): Promise<boolean> {
    try {
        const stat = await fs.stat(dir); // check whether directory exists
        // If it passes above line without error the directory does exist, just need to check that it is a dir and not a file.
        return stat.isDirectory();
    } catch (_e) {
        return false;
    }
}

/**
 * Ensures that the specified directory exists.
 * If it is already existing nothing is done and if it doesn't it will be created.
 * @param dir the directory that should be ensured to exist.
 */
export async function ensureDirectory(dir: string): Promise<void> {
    if ((await directoryExists(dir)) === false) {
        await fs.mkdir(dir);
    }
}

/**
 * Deletes a directory at the specified path in the filesystem.
 * @param dirPath the directory which should be deleted.
 */
export async function removeDirectory(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Executes the given command and optionally streams the output to the console.
 * @param command the command that should be executed.
 * @param args the args which will be passed to the command
 * @param streamOutput whether the output (stdout and stderr) should be streamed to the ones of the current process.
 *                     if there was an error stderr will always be written to the stderr of this process after the command has finished and failed.
 * @param workingDir in which directory the command should be executed
 * @return a promise which will be resolved if the command exited with a non-zero exit code and rejected otherwise.
 */
export async function executeCommand(command: string, args: string[], workingDir?: string): Promise<void> {
    logger.info(`>>> ${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
        cwd: workingDir,
        shell: true,
        stdio: "inherit",
    });

    // When the cli gets interrupted we also want to interrupt all processes that we have created.
    // On linux/macOS this happens automatically but not for windows.
    process.on("SIGINT", () => child.kill("SIGINT"));

    return new Promise((resolve, reject) => {
        child.addListener("error", (err) => reject(err));

        child.addListener("exit", (code) => {
            logger.info("");

            if (code === 0) {
                resolve(); // Success
            } else {
                // when code is null it means that the process has been terminated due to some OS signal
                // this usually happens when the user terminates the cli.
                if (code === null) {
                    reject(new Error("cli has been interrupted!"));
                }

                reject(`Command "${command} ${args.join(" ")}" returned error code ${code}!`);
            }
        });
    });
}
