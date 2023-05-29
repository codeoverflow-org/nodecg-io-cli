import { promises as fs } from "fs";
import { spawn } from "child_process";
import { logger } from "./log";

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
    if (!(await directoryExists(dir))) {
        await fs.mkdir(dir);
    }
}

/**
 * Executes the given command and optionally streams the output to the console.
 * @param command the command that should be executed.
 * @param args the args which will be passed to the command
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

                reject(new Error(`Command "${command} ${args.join(" ")}" returned error code ${code}!`));
            }
        });
    });
}
