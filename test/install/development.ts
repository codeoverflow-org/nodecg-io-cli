import { vol } from "memfs";
import * as git from "isomorphic-git";
import * as fsUtils from "../../src/fsUtils";
import { fsRoot, validDevInstall, nodecgIODir } from "../testUtils";
import * as dev from "../../src/install/development";

const defaultFetchResult: git.FetchResult = {
    defaultBranch: "master",
    fetchHead: "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed",
    fetchHeadDescription: "",
};
const altFetchResult: git.FetchResult = {
    ...defaultFetchResult,
    fetchHead: "e0c9035898dd52fc65c41454cec9c4d2611bfb37",
};

const cloneSpy = jest.spyOn(git, "clone").mockResolvedValue();
const fetchSpy = jest.spyOn(git, "fetch").mockResolvedValue(defaultFetchResult);
const mergeSpy = jest.spyOn(git, "merge").mockResolvedValue({});
const checkoutSpy = jest.spyOn(git, "checkout").mockResolvedValue();
const refSpy = jest.spyOn(git, "resolveRef").mockResolvedValue(defaultFetchResult.fetchHead ?? "");
const execSpy = jest.spyOn(fsUtils, "executeCommand").mockResolvedValue();

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

afterEach(() => {
    cloneSpy.mockClear();
    fetchSpy.mockClear();
    mergeSpy.mockClear();
    checkoutSpy.mockClear();
    execSpy.mockClear();
    refSpy.mockClear();
});

describe("createDevInstall", () => {
    test("should not do anything if HEAD commit hash didn't change", async () => {
        await dev.createDevInstall(validDevInstall, fsRoot, 0);
        expect(execSpy).toHaveBeenCalledTimes(0);
    });

    test("should execute install, bootstrap and build", async () => {
        fetchSpy.mockResolvedValueOnce(altFetchResult);
        await dev.createDevInstall(validDevInstall, fsRoot, 0);
        expect(execSpy).toHaveBeenCalledTimes(3);
    });

    test.todo("should only clone docs if wanted in installation info");
});

describe("getGitRepo", () => {
    test("should clone repo if directory does not exists", async () => {
        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(cloneSpy).toHaveBeenCalled();
    });

    test("should fetch repo if directory does exist", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(fetchSpy).toHaveBeenCalled();
        expect(mergeSpy).toHaveBeenCalledTimes(0);
        expect(checkoutSpy).toHaveBeenCalledTimes(0);
    });

    test("should merge and checkout if new commits were fetched", async () => {
        fetchSpy.mockResolvedValueOnce(altFetchResult);

        await vol.promises.mkdir(nodecgIODir);
        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(mergeSpy).toHaveBeenCalled();
        expect(checkoutSpy).toHaveBeenCalled();
    });

    test.todo("should use correct git url for nodecg-io and docs");
});
