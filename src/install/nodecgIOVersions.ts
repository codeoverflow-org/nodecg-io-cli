import * as semver from "semver";

export const corePackage = "nodecg-io-core";
export const dashboardPackage = "nodecg-io-dashboard";
export const developmentVersion = "development";

export const corePackages = [corePackage, dashboardPackage];

// To add a new release to this cli do the following (packages need to be already published on npm):
// 1. add a new array under here which has all the services of the release in it (you can use the spread operator with the previous release).
// 2. update supportedNodeCGIORange to include your new nodecg-io version.
// 3. update versionServiceMap and add the service array to the corresponding version.

// prettier-ignore
const version01Services = [
    "ahk", "android", "curseforge", "discord", "intellij", "irc", "midi-input", "midi-output", "nanoleaf", "obs",
    "philipshue", "rcon", "reddit", "sacn-receiver", "sacn-sender", "serial", "slack", "spotify", "streamdeck",
    "streamelements", "telegram", "tiane", "twitch-addons", "twitch-api", "twitch-chat", "twitch-pubsub",
    "twitter", "websocket-client", "websocket-server", "xdotool", "youtube",
];

export const supportedNodeCGIORange = new semver.Range("<=0.1");

export const versionServiceMap: Record<string, string[]> = {
    "0.1": version01Services,
};

/**
 * Returns you a list of services that are available for the passed nodecg-io version.
 * @param version the major.minor nodecg-io version
 * @returns all services of the passed version
 */
export function getServicesForVersion(version: string): string[] {
    const services = versionServiceMap[version];

    if (services === undefined) {
        throw new Error(`Don't have any service list for version ${version}. Something might be wrong here.`);
    }

    return services;
}
