import * as fs from "fs/promises";
import * as path from "path";
import * as findUp from "find-up";
import { spawn } from "child_process";
import { logger } from "./log";

export const corePackage = "nodecg-io-core";
export const dashboardPackage = "nodecg-io-dashboard";
export const developmentVersion = "development";

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(): Promise<string | undefined> {
    return await findUp(async (dir) => ((await isNodeCGDirectory(dir)) ? dir : undefined), { type: "directory" });
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
 * Ensures that teh specified directory exists.
 * If it is already existing nothing is done and if it doesn't it will be created.
 * @param dir the directory that should be ensured to exist.
 */
export async function ensureDirectory(dir: string): Promise<void> {
    if ((await directoryExists(dir)) === false) {
        await fs.mkdir(dir);
    }
}

// TODO: maybe use execa
// TODO: show in which directory the command is executed.
// TODO: passthrough color if supported

/**
 * Executes the given command and optionally streams the output to the console.
 * @param command the command that should be executed.
 * @param args the args which will be passed to the command
 * @param streamOutput whether the output (stdout and stderr) should be streamed to the ones of the current process.
 *                     if there was an error stderr will always be written to the stderr of this process after the command has finished and failed.
 * @param workingDir in which directory the command should be executed
 * @return a promise which will be resolved if the command exited with a non-zero exit code and rejected otherwise.
 */
export async function executeCommand(
    command: string,
    args: string[],
    streamOutput: boolean,
    workingDir?: string,
): Promise<void> {
    if (streamOutput) logger.info(`>>> ${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
        cwd: workingDir,
        shell: true,
        stdio: streamOutput ? "inherit" : undefined,
    });

    return new Promise((resolve, reject) => {
        child.addListener("error", (err) => reject(err));

        child.addListener("exit", (code) => {
            if (streamOutput) logger.info();

            if (code === 0) {
                resolve();
            } else {
                // when code is null it means that the process has been terminated due to some OS signal
                // this usually happens when the user terminates the cli.
                if (code === null) {
                    reject(new Error("cli has been interrupted!"));
                }

                // There was an error so we should present the user with the error message even if the output of this command
                // should not be streamed normally, because the user needs it to be able to debug the problem.
                if (!streamOutput) {
                    child.stderr?.pipe(process.stderr);
                }
                reject(`Command "${command} ${args.join(" ")}" returned error code ${code}!`);
            }
        });
    });
}
