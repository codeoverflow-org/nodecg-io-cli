import { vol } from "memfs";
import { readInstallInfo, writeInstallInfo } from "../../src/utils/installation";
import { fsRoot, installJsonPath, validDevInstall } from "../testUtils";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

describe("readInstallInfo", () => {
    test("should be able to read valid file", async () => {
        vol.promises.writeFile(installJsonPath, JSON.stringify(validDevInstall));

        const install = await readInstallInfo(fsRoot);
        expect(install).toBeDefined();
        expect(install).toStrictEqual(validDevInstall);
    });

    test("should return undefined if file is not available", async () => {
        const install = await readInstallInfo(fsRoot);
        expect(install).toBeUndefined();
    });
});

describe("writeInstallInfo", () => {
    test("should be able to write valid file", async () => {
        await writeInstallInfo(fsRoot, validDevInstall);

        const content = await vol.promises.readFile(installJsonPath);
        const json = JSON.parse(content.toString());
        expect(json).toStrictEqual(validDevInstall);
    });
});
