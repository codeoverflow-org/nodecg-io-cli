import * as path from "path";
import { createFsFromVolume, vol } from "memfs";
import { nodecgPackageJsonStr, testDir } from "../testUtils";
import { findNodeCGDirectory, getNodeCGVersion } from "../../src/utils/nodecgInstallation";
import { SemVer } from "semver";

jest.mock("fs", () => createFsFromVolume(vol));
afterEach(() => vol.reset());

const nodecgDir = path.join(testDir, "nodecg");
const nodecgSubDir = path.join(nodecgDir, "subDirectory");
const packageJsonFile = path.join(nodecgDir, "package.json");

beforeEach(async () => {
    await vol.promises.mkdir(testDir);
    await vol.promises.mkdir(nodecgDir);
    await vol.promises.mkdir(nodecgSubDir);

    // Fake package.json of a real nodecg install
    await vol.promises.writeFile(packageJsonFile, nodecgPackageJsonStr);
});

describe("findNodeCGDirectory", () => {
    test("should work when calling inside a nodecg install", async () => {
        await expect(findNodeCGDirectory(nodecgDir)).resolves.toBe(nodecgDir);
    });

    test("should work when calling in sub directory of a nodecg install", async () => {
        await expect(findNodeCGDirectory(nodecgSubDir)).resolves.toBe(nodecgDir);
    });

    test("should work when cwd is pointing to a file inside a nodecg install", async () => {
        await expect(findNodeCGDirectory(packageJsonFile)).resolves.toBe(nodecgDir);
    });

    test("should error if not inside any nodecg directory", async () => {
        await expect(findNodeCGDirectory("/")).rejects.toThrow("Couldn't find a nodecg install");
    });
});

describe("getNodeCGVersion", () => {
    test("should return correct version", async () => {
        await expect(getNodeCGVersion(nodecgDir)).resolves.toStrictEqual(new SemVer("1.8.0"));
    });
});
