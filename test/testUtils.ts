import * as temp from "temp";
import { corePackage } from "../src/install/nodecgIOVersions";
import * as path from "path";
import { DevelopmentInstallation, ProductionInstallation } from "../src/installation";

/**
 * The root directory of memfs. Differs on unix-like and windows systems.
 */
export const fsRoot = process.platform === "win32" ? "D:\\" : "/";

export const oldNpmVersion = "6.1.2";
export const validNpmVersion = "7.0.0";
export const invalidPkgName = "something-hopefully-invalid";
export const corePkg = {
    name: corePackage,
    path: corePackage,
    version: "0.1.0",
};
export const twitchChatPkg = {
    name: "nodecg-io-twitch-chat",
    path: "nodecg-io-twitch-chat",
    version: "0.1.0",
};
export const nodecgExampleConfig = {
    bundles: {
        paths: ["some-custom-bundle-dir"],
        disabled: ["nodecg-io-debug"],
    },
    developer: true,
    logging: {
        console: {
            level: "trace",
        },
    },
};
export const cfgDir = path.join(fsRoot, "cfg");
export const nodecgCfgPath = path.join(cfgDir, "nodecg.json");
export const installJsonPath = path.join(fsRoot, "install.json");
export const validDevInstall: DevelopmentInstallation = {
    dev: true,
    version: "development",
    useSamples: false,
    commitHash: "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed",
};
export const validProdInstall: ProductionInstallation = {
    dev: false,
    version: "0.1.0",
    packages: [],
};
export const testDir = path.join(fsRoot, "testDir");
export const nodecgIODir = path.join(fsRoot, "nodecg-io");

temp.track();
afterEach(() => temp.cleanup());

export function tempDir(): Promise<string> {
    return temp.mkdir("nodecg-io-cli-test");
}
