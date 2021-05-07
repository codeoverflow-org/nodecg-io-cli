import * as path from "path";
import { logger } from "../utils/log";
import { directoryExists } from "../utils/fs";
import * as fs from "fs";
import * as chalk from "chalk";

// Colored commands for logging purposes.
export const yellowInstallCommand = chalk.yellow("nodecg-io install");
export const yellowGenerateCommand = chalk.yellow("nodecg-io generate");

/**
 * Writes a file for a bundle.
 * @param content the file content. A object will automatically be converted to a string and pretty printed.
 * @param paths the path to the file. You should probably start with the bundle path and add directories/filenames.
 */
export async function writeBundleFile(content: string | Record<string, unknown>, ...paths: string[]): Promise<void> {
    const finalPath = path.join(...paths);

    logger.debug(`Writing file at ${finalPath}`);

    // Create directory if missing
    const parent = path.dirname(finalPath);
    if (!(await directoryExists(parent))) {
        await fs.promises.mkdir(parent);
    }

    const str = typeof content === "string" ? content : JSON.stringify(content, null, 4);
    await fs.promises.writeFile(finalPath, str);
}
