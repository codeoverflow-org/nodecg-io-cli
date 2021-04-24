import { vol } from "memfs";
import * as git from "isomorphic-git";
import * as fsUtils from "../../src/fsUtils";
import { fsRoot, validDevInstall, nodecgIODir } from "../testUtils";
import { createDevInstall, getGitRepo } from "../../src/install/development";

const cloneSpy = jest.spyOn(git, "clone").mockResolvedValue();
const ffSpy = jest.spyOn(git, "fastForward").mockResolvedValue();
const refSpy = jest.spyOn(git, "resolveRef").mockResolvedValue(validDevInstall.commitHash ?? "");
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
        await createDevInstall(validDevInstall, validDevInstall, fsRoot, 0);
        expect(execSpy).toHaveBeenCalledTimes(0);
    });

    test("should execute install, bootstrap and build", async () => {
        await createDevInstall(
            validDevInstall,
            {
                ...validDevInstall,
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
