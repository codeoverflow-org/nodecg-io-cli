import { vol } from "memfs";
import * as git from "isomorphic-git";
import * as fsUtils from "../../src/utils/fs";
import { fsRoot, validDevInstall, nodecgIODir } from "../test.util";
import * as dev from "../../src/install/development";
import { removeDirectory } from "../../src/utils/fs";

const defaultFetchResult: git.FetchResult = {
    defaultBranch: "master",
    fetchHead: "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed",
    fetchHeadDescription: "",
};
const altFetchResult: git.FetchResult = {
    ...defaultFetchResult,
    fetchHead: "e0c9035898dd52fc65c41454cec9c4d2611bfb37",
};

const cloneSpy = jest.spyOn(git, "clone").mockImplementation((opts) => vol.promises.mkdir(opts.dir));
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
        await dev.createDevInstall(validDevInstall, fsRoot);
        expect(execSpy).toHaveBeenCalledTimes(0);
    });

    test("should execute install and build", async () => {
        fetchSpy.mockResolvedValueOnce(altFetchResult);
        await dev.createDevInstall(validDevInstall, fsRoot);
        expect(execSpy).toHaveBeenCalledTimes(2);
    });

    test("should not clone docs if not wanted in installation info", async () => {
        // cloneDocs is false in validDevInstall, don't need to change it
        await dev.createDevInstall(validDevInstall, nodecgIODir);
        expect(cloneSpy).toHaveBeenCalledTimes(1);
    });

    test("should clone docs if wanted", async () => {
        await dev.createDevInstall(
            {
                ...validDevInstall,
                cloneDocs: true,
            },
            nodecgIODir,
        );
        expect(cloneSpy).toHaveBeenCalledTimes(2);
    });
});

describe("getGitRepo", () => {
    beforeEach(() => vol.promises.mkdir(nodecgIODir));

    test("should clone repo if directory does not exists", async () => {
        // remove dir so it should clone
        await removeDirectory(nodecgIODir);

        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(cloneSpy).toHaveBeenCalled();
    });

    test("should fetch repo if directory does exist", async () => {
        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(fetchSpy).toHaveBeenCalled();
        expect(mergeSpy).toHaveBeenCalledTimes(0);
        expect(checkoutSpy).toHaveBeenCalledTimes(0);
    });

    test("should merge and checkout if new commits were fetched", async () => {
        fetchSpy.mockResolvedValueOnce(altFetchResult);

        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        expect(mergeSpy).toHaveBeenCalled();
        expect(checkoutSpy).toHaveBeenCalled();
    });

    test("should use correct git url for nodecg-io and docs", async () => {
        await dev.getGitRepo(nodecgIODir, "nodecg-io");
        await dev.getGitRepo(nodecgIODir, "nodecg-io-docs");
        expect(fetchSpy.mock.calls[0][0].url?.endsWith("nodecg-io.git")).toBe(true);
        expect(fetchSpy.mock.calls[1][0].url?.endsWith("nodecg-io-docs.git")).toBe(true);
    });
});
