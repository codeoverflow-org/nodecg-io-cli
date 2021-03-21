import { Installation } from "../installation";
import * as inquirer from "inquirer";
import { getHighestPatchVersion, getMinorVersions, NpmPackage } from "../npmPackage";
import { corePackage, dashboardPackage, developmentVersion } from "../utils";

const corePackages = [corePackage, dashboardPackage];
const version01Services = [
    "ahk",
    "android",
    "curseforge",
    "discord",
    "intellij",
    "irc",
    "midi-input",
    "midi-output",
    "nanoleaf",
    "obs",
    "philipshue",
    "rcon",
    "reddit",
    "sacn-receiver",
    "sacn-sender",
    "serial",
    "slack",
    "spotify",
    "streamdeck",
    "streamelements",
    "telegram",
    "tiane",
    "twitch-addons",
    "twitch-api",
    "twitch-chat",
    "twitch-pubsub",
    "twitter",
    "websocket-client",
    "websocket-server",
    "xdotool",
    "youtube",
];

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
        {
            type: "checkbox",
            name: "services",
            message: "Which services do you want to use?",
            choices: version01Services,
            when: (x) => x.version !== developmentVersion,
        },
    ]);

    if (res.version === developmentVersion) {
        return { ...res, dev: true };
    } else {
        return { ...res, dev: false, packages: await buildPackageList(res.version, res.services) };
    }
}

async function buildPackageList(version: string, services: string[]): Promise<NpmPackage[]> {
    const promises = [...corePackages, ...services.map((name) => `nodecg-io-${name}`)].map(async (pkgName) => ({
        name: pkgName,
        path: pkgName === dashboardPackage ? `${corePackage}/dashboard` : pkgName,
        version: (await getHighestPatchVersion(pkgName, version)) ?? `${version}.0`,
    }));

    return await Promise.all(promises);
}
