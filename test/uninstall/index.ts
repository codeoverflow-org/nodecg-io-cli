import { vol } from "memfs";
import { uninstall } from "../../src/uninstall";
import * as fsUtils from "../../src/utils/fs";
import * as nodecgConfig from "../../src/utils/nodecgConfig";
import { fsRoot } from "../testUtils";
import * as path from "path";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

const nodecgIODir = path.join(fsRoot, "nodecg-io");

jest.spyOn(fsUtils, "findNodeCGDirectory").mockResolvedValue(fsRoot);
const spyManageBundleDir = jest.spyOn(nodecgConfig, "manageBundleDir");
const spyRemoveDirectory = jest.spyOn(fsUtils, "removeDirectory");

afterEach(() => {
    spyManageBundleDir.mockClear();
    spyRemoveDirectory.mockClear();
});

describe("uninstall", () => {
    test("should not do anything if there is no nodecg-io directory", async () => {
        await uninstall();

        expect(spyRemoveDirectory).not.toHaveBeenCalled();
        expect(spyManageBundleDir).not.toHaveBeenCalled();
    });

    test("should remove entries from nodecg config", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await uninstall();

        expect(spyManageBundleDir).toHaveBeenCalledTimes(2);

        // Should remove nodecg-io directory and sample bundle directory (if applicable)
        expect(spyManageBundleDir.mock.calls[0][1]).toBe(nodecgIODir);
        expect(spyManageBundleDir.mock.calls[1][1]).toBe(path.join(nodecgIODir, "samples"));

        // Should remove them, not add them
        expect(spyManageBundleDir.mock.calls[0][2]).toBe(false);
        expect(spyManageBundleDir.mock.calls[1][2]).toBe(false);
    });

    test("should remove nodecg-io directory", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await uninstall();

        expect(spyRemoveDirectory).toHaveBeenCalledWith(nodecgIODir);
    });
});
