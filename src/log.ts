import * as chalk from "chalk";

// This is a very small logger that just adapts the color of the messages that you log
// unimportant messages get dim colors and important ones get brighter colors.

function buildLogFunction(color: chalk.Chalk | undefined, stdErr = false): (msg?: string) => void {
    return (msg) => {
        if (msg) {
            const coloredMsg = color ? color(msg) : msg;
            if (stdErr) {
                console.error(coloredMsg);
            } else {
                console.log(coloredMsg);
            }
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
