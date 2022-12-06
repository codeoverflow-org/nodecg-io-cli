import semver from "semver";
import * as path from "path";

export const corePackage = "nodecg-io-core";
export const dashboardPackage = "nodecg-io-dashboard";
export const dashboardPath = corePackage + path.sep + "dashboard";
export const developmentVersion = "development";

export const corePackages = [corePackage, dashboardPackage];

// To add a new release to this cli do the following (packages must already be published on npm):
// 1. add a new object under here which has all the services of the release in it (you can use the spread operator with the previous release).
// 2. update supportedNodeCGIORange to include your new nodecg-io version.
// 3. update versionServiceMap and add the service object to the corresponding version.

const version01Services = {
    ahk: "AHKServiceClient",
    android: "AndroidServiceClient",
    curseforge: "CurseForgeClient",
    discord: "DiscordServiceClient",
    intellij: "IntelliJServiceClient",
    irc: "IRCServiceClient",
    "midi-input": "MidiInputServiceClient",
    "midi-output": "MidiOutputServiceClient",
    nanoleaf: "NanoleafServiceClient",
    obs: "OBSServiceClient",
    philipshue: "PhilipsHueServiceClient",
    rcon: "RconServiceClient",
    reddit: "RedditServiceClient",
    "sacn-receiver": "SacnReceiverServiceClient",
    "sacn-sender": "SacnSenderServiceClient",
    serial: "SerialServiceClient",
    slack: "SlackServiceClient",
    spotify: "SpotifyServiceClient",
    streamdeck: "StreamdeckServiceClient",
    streamelements: "StreamElementsServiceClient",
    telegram: "TelegramServiceClient",
    tiane: "TianeServiceClient",
    "twitch-addons": "TwitchAddonsClient",
    "twitch-api": "TwitchApiServiceClient",
    "twitch-chat": "TwitchChatServiceClient",
    "twitch-pubsub": "TwitchPubSubServiceClient",
    twitter: "TwitterServiceClient",
    "websocket-client": "WSClientServiceClient",
    "websocket-server": "WSServerServiceClient",
    xdotool: "XdotoolServiceClient",
    youtube: "YoutubeServiceClient",
};

const version02Services = {
    ...version01Services,
    artnet: "ArtNetServiceClient",
    atem: "AtemServiceClient",
    dbus: "DBusClient",
    debug: "DebugHelper",
    "discord-rpc": "DiscordRpcClient",
    "elgato-light": "ElgatoLightClient",
    googleapis: "GoogleApisServiceClient",
    github: "GitHubClient",
    "mqtt-client": "MQTTClientServiceClient",
    shlink: "ShlinkServiceClient",
    sql: "SQLClient",
    youtube: undefined,
};

export const supportedNodeCGIORange = new semver.Range("<=0.2");

export const versionServiceMap: Record<string, Record<string, string | undefined>> = {
    "0.1": version01Services,
    "0.2": version02Services,
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

    const serviceNames = Object.keys(services)
        // only services which have a corresponding service class
        // this is not the case when e.g. the service only existed in a previous version
        .filter((svcName) => services[svcName] !== undefined);
    serviceNames.sort();
    return serviceNames;
}

/**
 * Returns you the client type name for the service in the specified nodecg-io version.
 * @param service the service you want to get the client name for
 * @param version the nodecg-io version (name might change between versions)
 * @returns the client name
 */
export function getServiceClientName(service: string, version: string): string {
    const svcClientMapping = versionServiceMap[version];
    const clientName = svcClientMapping?.[service];
    if (clientName === undefined) {
        throw new Error(`Access of undefined service client name for ${service}@${version}`);
    }

    return clientName;
}
