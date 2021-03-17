import { Installation } from "../installation";
import * as inquirer from "inquirer";

const releasedVersions = ["0.1"]; // TODO: fetch dynamically
const devVersion = "development";

export async function promptForInstallInfo(): Promise<Installation> {
    const res = await inquirer.prompt([
        {
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: [devVersion, ...releasedVersions],
            default: releasedVersions.slice(-1)[0],
        },
        {
            type: "confirm",
            name: "useSamples",
            message: "Would you like to use the provided samples?",
            when: (x) => x.version === devVersion,
            default: false,
        },
    ]);

    return { ...res, dev: res.version === devVersion };
}
