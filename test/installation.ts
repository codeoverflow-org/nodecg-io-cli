import { vol } from "memfs";
import { DevelopmentInstallation, readInstallInfo, writeInstallInfo } from "../src/installation";
import { fsRoot } from "./testUtils";
import * as path from "path";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

const installJsonPath = path.join(fsRoot, "install.json");
const validInstall: DevelopmentInstallation = {
    dev: true,
    version: "development",
    useSamples: false,
    commitHash: "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed",
};

describe("readInstallInfo", () => {
    test("should be able to read valid file", async () => {
        vol.promises.writeFile(installJsonPath, JSON.stringify(validInstall));

        const install = await readInstallInfo(fsRoot);
        expect(install).toBeDefined();
        expect(install).toStrictEqual(validInstall);
    });

    test("should return undefined if file is not available", async () => {
        const install = await readInstallInfo(fsRoot);
        expect(install).toBeUndefined();
    });
});

describe("writeInstallInfo", () => {
    test("should be able to write valid file", async () => {
        await writeInstallInfo(fsRoot, validInstall);

        const content = await vol.promises.readFile(installJsonPath);
        const json = JSON.parse(content.toString());
        expect(json).toStrictEqual(validInstall);
    });
});
