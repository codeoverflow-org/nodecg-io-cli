import { createFsFromVolume, vol } from "memfs";
import { createNpmSymlinks, getSubPackages, removeNpmPackage, runNpmInstall } from "../../../src/utils/npm";
import { tempDir, corePkg, fsRoot, twitchChatPkg, dashboardPkg } from "../../testUtils";
import * as fsUtils from "../../../src/utils/fs";
import * as path from "path";

jest.mock("fs", () => createFsFromVolume(vol));
afterEach(() => vol.reset());

describe("runNpmInstall", () => {
    test("should execute npm install", async () => {
        const spy = jest.spyOn(fsUtils, "executeCommand").mockResolvedValue();
        await runNpmInstall(fsRoot);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toBe("npm");
        expect(spy.mock.calls[0][1][0]).toBe("install");
    });
});

describe("createNpmSymlinks", () => {
    test("should create appropriate symlink", async () => {
        // Create directory where core is "installed" (it isn't but we need the dir so the node_modules in this dir can be created)
        vol.promises.mkdir(path.join(fsRoot, corePkg.path));

        const spy = jest.spyOn(vol.promises, "symlink").mockResolvedValue();
        const pkg = {
            ...corePkg,
            symlink: ["test-abc"],
        };
        await createNpmSymlinks([pkg], fsRoot);

        expect(spy).toHaveBeenCalled();
        // should create it in /nodecg-io-core/node_modules/test-abc (local node_modules)
        expect(spy.mock.calls[0][1]).toBe(path.join(fsRoot, corePkg.path, "node_modules", "test-abc"));

        // should point to /node_modules/test-abc (hoisted package)
        expect(spy.mock.calls[0][0]).toBe(path.join(fsRoot, "node_modules", "test-abc"));
    });
});

describe("removeNpmPackage", () => {
    test("should call to fsUtils.removeDirectory", async () => {
        const spy = jest.spyOn(fsUtils, "removeDirectory").mockResolvedValue();
        await removeNpmPackage(corePkg, await tempDir());
        expect(spy).toHaveBeenCalled();
    });
});

describe("getSubPackages", () => {
    test("should return empty list if no packages are inside the passed package", async () => {
        expect(getSubPackages([corePkg, twitchChatPkg], corePkg)).toStrictEqual([]);
    });

    test("should return dashboard to be inside core", async () => {
        expect(getSubPackages([corePkg, dashboardPkg], corePkg)).toStrictEqual([dashboardPkg]);
    });
});
