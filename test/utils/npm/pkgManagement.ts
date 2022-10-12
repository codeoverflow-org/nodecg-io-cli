import { createFsFromVolume, vol } from "memfs";
import {
    createNpmSymlinks,
    getSubPackages,
    removeNpmPackage,
    runNpmBuild,
    runNpmInstall,
} from "../../../src/utils/npm";
import { tempDir, corePkg, fsRoot, twitchChatPkg, dashboardPkg } from "../../test.util";
import * as fsUtils from "../../../src/utils/fs";
import * as path from "path";
import * as fs from "fs";

jest.mock("fs", () => createFsFromVolume(vol));
afterEach(() => vol.reset());

const npmCommand = "npm";
const execMock = jest.spyOn(fsUtils, "executeCommand").mockResolvedValue();

afterEach(() => execMock.mockClear());

describe("runNpmInstall", () => {
    test("should execute npm install --omit=dev when installing only production dependencies", async () => {
        await runNpmInstall(fsRoot, true);
        expect(execMock).toHaveBeenCalled();
        expect(execMock.mock.calls[0]?.[0]).toBe(npmCommand);
        expect(execMock.mock.calls[0]?.[1]?.[0]).toBe("install");
        expect(execMock.mock.calls[0]?.[1]?.[1]).toBe("--omit=dev");
        expect(execMock.mock.calls[0]?.[2]).toBe(fsRoot);
    });

    test("should execute npm install when installing prod and dev", async () => {
        await runNpmInstall(fsRoot, false);
        expect(execMock).toHaveBeenCalled();
        expect(execMock.mock.calls[0]?.[0]).toBe(npmCommand);
        expect(execMock.mock.calls[0]?.[1]?.[0]).toBe("install");
        expect(execMock.mock.calls[0]?.[1].length).toBe(1);
    });
});

describe("runNpmBuild", () => {
    test("should execute install script with passed arguments", async () => {
        await runNpmBuild(fsRoot, "arg");
        expect(execMock).toHaveBeenCalled();
        expect(execMock.mock.calls[0]?.[0]).toBe(npmCommand);
        expect(execMock.mock.calls[0]?.[1]?.[1]).toBe("build");
        expect(execMock.mock.calls[0]?.[1]?.[2]).toBe("arg"); // Custom arg from above
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
        expect(spy.mock.calls[0]?.[1]).toBe(path.join(fsRoot, corePkg.path, "node_modules", "test-abc"));

        // should point to /node_modules/test-abc (hoisted package)
        expect(spy.mock.calls[0]?.[0]).toBe(path.join(fsRoot, "node_modules", "test-abc"));
    });
});

describe("removeNpmPackage", () => {
    test("should call to fs.promises.rm to delete directory", async () => {
        const spy = jest.spyOn(fs.promises, "rm").mockResolvedValue();
        await removeNpmPackage(corePkg, await tempDir());
        expect(spy).toHaveBeenCalled();
        // Ensure that recursive deletion is enabled
        expect(spy.mock.calls[0]?.[1]?.recursive).toBe(true);
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
