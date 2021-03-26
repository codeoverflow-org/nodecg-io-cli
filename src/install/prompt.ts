import { Installation } from "../installation";
import * as inquirer from "inquirer";
import { getHighestPatchVersion, getMinorVersions, NpmPackage } from "../npmPackage";
import { corePackage, dashboardPackage, developmentVersion } from "../fsUtils";
import { version as cliVersion } from "../../package.json";
import * as semver from "semver";

const corePackages = [corePackage, dashboardPackage];
// prettier-ignore
const version01Services = [
    "ahk", "android", "curseforge", "discord", "intellij", "irc", "midi-input", "midi-output", "nanoleaf", "obs",
    "philipshue", "rcon", "reddit", "sacn-receiver", "sacn-sender", "serial", "slack", "spotify", "streamdeck",
    "streamelements", "telegram", "tiane", "twitch-addons", "twitch-api", "twitch-chat", "twitch-pubsub",
    "twitter", "websocket-client", "websocket-server", "xdotool", "youtube",
];

export async function promptForInstallInfo(): Promise<Installation> {
    const versions = await getInstallableVersions();
    const res = await inquirer.prompt([
        {
            type: "list",
            name: "version",
            message: "Which version do you want to install?",
            choices: [...versions, developmentVersion].reverse(),
            loop: false,
            default: versions.slice(-1)[0],
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

async function getInstallableVersions(): Promise<string[]> {
    const all = await getMinorVersions(corePackage);
    const { major, minor } = new semver.SemVer(cliVersion);
    const range = new semver.Range(`<=${major}.${minor}`);

    const notInstallableVersions: string[] = [];

    const filtered = all.filter((v) => {
        if (semver.satisfies(`${v}.0`, range)) {
            return true;
        } else {
            notInstallableVersions.push(v);
            return false;
        }
    });

    if (notInstallableVersions.length) {
        // TODO: direct user to update cli?
        const versionList = notInstallableVersions.join(", ");
        console.log(`Cannot install the following versions because the cli doesn't support them yet: ${versionList}`);
    }
    return filtered;
}

async function buildPackageList(version: string, services: string[]): Promise<NpmPackage[]> {
    const promises = [...corePackages, ...services.map((name) => `nodecg-io-${name}`)].map(async (pkgName) => ({
        name: pkgName,
        path: pkgName === dashboardPackage ? `${corePackage}/dashboard` : pkgName,
        version: (await getHighestPatchVersion(pkgName, version)) ?? `${version}.0`,
    }));

    return await Promise.all(promises);
}
