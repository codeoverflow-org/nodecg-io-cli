import { vol } from "memfs";
import * as path from "path";
import * as git from "isomorphic-git";
import * as fsUtils from "../../src/fsUtils";
import { fsRoot } from "../testUtils";
import { createDevInstall, getGitRepo } from "../../src/install/development";
import { DevelopmentInstallation } from "../../src/installation";

const nodecgIODir = path.join(fsRoot, "nodecg-io");
const install: DevelopmentInstallation = {
    dev: true,
    version: "development",
    useSamples: false,
    commitHash: "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed",
};

const cloneSpy = jest.spyOn(git, "clone").mockResolvedValue();
const ffSpy = jest.spyOn(git, "fastForward").mockResolvedValue();
const refSpy = jest.spyOn(git, "resolveRef").mockResolvedValue(install.commitHash ?? "");
const execSpy = jest.spyOn(fsUtils, "executeCommand").mockResolvedValue();

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

afterEach(() => {
    cloneSpy.mockClear();
    ffSpy.mockClear();
    execSpy.mockClear();
    refSpy.mockReset();
});

describe("createDevInstall", () => {
    test("should not do anything if HEAD commit hash didn't change", async () => {
        await createDevInstall(install, install, fsRoot, 0);
        expect(execSpy).toHaveBeenCalledTimes(0);
    });

    test("should execute install, bootstrap and build", async () => {
        await createDevInstall(
            install,
            {
                ...install,
                commitHash: "abc",
            },
            fsRoot,
            0,
        );

        expect(execSpy).toHaveBeenCalledTimes(3);
    });
});

describe("getGitRepo", () => {
    test("should clone repo if directory does not exists", async () => {
        await getGitRepo(nodecgIODir);
        expect(cloneSpy).toHaveBeenCalled();
    });

    test("should pull repo if directory does exist", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await getGitRepo(nodecgIODir);
        expect(ffSpy).toHaveBeenCalled();
    });
});
