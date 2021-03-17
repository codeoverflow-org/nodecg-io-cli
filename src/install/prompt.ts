import { Installation } from "../installation";
import * as inquirer from "inquirer";
import { getMinorVersions } from "../npmPackage";
import { corePackage, developmentVersion } from "../utils";

export async function promptForInstallInfo(): Promise<Installation> {
    // TODO: filter versions that are too new for the installed cli version and show a warning that you would need to update.
    const releasedVersions = await getMinorVersions(corePackage);
    const res = await inquirer.prompt([
        {
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: [...releasedVersions, developmentVersion].reverse(),
            loop: false,
            default: releasedVersions.slice(-1)[0],
        },
        {
            type: "confirm",
            name: "useSamples",
            message: "Would you like to use the provided samples?",
            when: (x) => x.version === developmentVersion,
            default: false,
        },
    ]);

    return { ...res, dev: res.version === developmentVersion };
}
