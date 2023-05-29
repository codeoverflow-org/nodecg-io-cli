import { vol } from "memfs";
import { uninstall } from "../../src/uninstall";
import * as nodecgInstall from "../../src/utils/nodecgInstallation";
import * as nodecgConfig from "../../src/utils/nodecgConfig";
import { fsRoot } from "../test.util";
import * as path from "path";
import * as fs from "fs";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

const nodecgIODir = path.join(fsRoot, "nodecg-io");

jest.spyOn(nodecgInstall, "findNodeCGDirectory").mockResolvedValue(fsRoot);
const spyManageBundleDir = jest.spyOn(nodecgConfig, "manageBundleDir");
const spyRm = jest.spyOn(fs.promises, "rm");

afterEach(() => {
    spyManageBundleDir.mockClear();
    spyRm.mockClear();
});

describe("uninstall", () => {
    test("should not do anything if there is no nodecg-io directory", async () => {
        await uninstall();

        expect(spyRm).not.toHaveBeenCalled();
        expect(spyManageBundleDir).not.toHaveBeenCalled();
    });

    test("should remove entries from nodecg config", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await uninstall();

        expect(spyManageBundleDir).toBeCalledTimes(3);

        // Should remove nodecg-io directory and sample bundle directory (if applicable)
        expect(spyManageBundleDir.mock.calls[0]?.[1]).toBe(nodecgIODir);
        expect(spyManageBundleDir.mock.calls[1]?.[1]).toBe(path.join(nodecgIODir, "services"));
        expect(spyManageBundleDir.mock.calls[2]?.[1]).toBe(path.join(nodecgIODir, "samples"));
        // Should remove them, not add them
        expect(spyManageBundleDir.mock.calls[0]?.[2]).toBe(false);
        expect(spyManageBundleDir.mock.calls[1]?.[2]).toBe(false);
        expect(spyManageBundleDir.mock.calls[2]?.[2]).toBe(false);
    });

    test("should remove nodecg-io directory", async () => {
        await vol.promises.mkdir(nodecgIODir);
        await uninstall();

        expect(spyRm).toHaveBeenCalledWith(nodecgIODir, { recursive: true, force: true });
    });
});
