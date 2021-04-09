import * as chalk from "chalk";

// This is a very small logger that just adapts the color of the messages that you log
// unimportant messages get dim colors and important ones get brighter colors.

/**
 * Creates a log function which will take a message and log it with the passed color.
 * @param color the color which will be used by the returned log function
 * @param stdErr whether to log to stderr or to stdout
 */
function buildLogFunction(color: chalk.Chalk | undefined, stdErr = false): (msg: string | undefined) => void {
    return (msg) => {
        const coloredMsg = color ? color(msg) : msg;
        if (stdErr) {
            console.error(coloredMsg);
        } else {
            console.log(coloredMsg);
        }
    };
}

export const logger = {
    info: buildLogFunction(undefined),
    debug: buildLogFunction(chalk.dim),
    success: buildLogFunction(chalk.green),
    warn: buildLogFunction(chalk.yellow),
    error: buildLogFunction(chalk.red, true),
};
