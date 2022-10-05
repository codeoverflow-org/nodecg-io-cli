import { vol } from "memfs";
import * as path from "path";
import * as fs from "fs";
import { corePkg, dashboardPkg, nodecgIODir, twitchChatPkg, validProdInstall } from "../test.util";
import { diffPackages, installPackages, removePackages, validateInstall } from "../../src/install/production";
import * as installation from "../../src/utils/installation";
import * as fsUtils from "../../src/utils/fs";
import * as npm from "../../src/utils/npm";

jest.mock("fs", () => vol);
beforeEach(() => vol.promises.mkdir(nodecgIODir));
afterEach(() => vol.reset());

const writeInstallInfoMock = jest.spyOn(installation, "writeInstallInfo").mockResolvedValue();
afterEach(() => writeInstallInfoMock.mockClear());

const corePkg2 = {
    ...corePkg,
    version: "0.2.0",
};
const packages = [corePkg, twitchChatPkg];

describe("diffPackages", () => {
    test("should return not already installed package in pkgInstall", () => {
        const { pkgInstall, pkgRemove } = diffPackages([twitchChatPkg, corePkg], [twitchChatPkg]);
        expect(pkgRemove).toStrictEqual([]);
        expect(pkgInstall).toStrictEqual([corePkg]);
    });

    test("should return not already removed package in pkgRemove", () => {
        const { pkgInstall, pkgRemove } = diffPackages([twitchChatPkg], [twitchChatPkg, corePkg]);
        expect(pkgRemove).toStrictEqual([corePkg]);
        expect(pkgInstall).toStrictEqual([]);
    });

    test("should return changed package in pkgInstall and pkgRemove", () => {
        // corePkg and corePkg2 differ in their version, therefore the old version should be removed
        // and the new one should be installed
        const { pkgInstall, pkgRemove } = diffPackages([twitchChatPkg, corePkg2], [twitchChatPkg, corePkg]);
        expect(pkgRemove).toStrictEqual([corePkg]);
        expect(pkgInstall).toStrictEqual([corePkg2]);
    });

    test("should not return if wanted state is already reached", () => {
        const { pkgInstall, pkgRemove } = diffPackages([twitchChatPkg, corePkg], [twitchChatPkg, corePkg]);
        expect(pkgRemove).toStrictEqual([]);
        expect(pkgInstall).toStrictEqual([]);
    });

    test("should install dashboard (sub pkg) if upgrading core", async () => {
        // dashboard not modified, but should still be installed because it is in core and core gets upgraded
        const { pkgInstall, pkgRemove } = diffPackages([corePkg2, dashboardPkg], [corePkg, dashboardPkg]);
        expect(pkgRemove).toStrictEqual([corePkg]);
        expect(pkgInstall).toStrictEqual([corePkg2, dashboardPkg]);
    });
});

describe("removePackages", () => {
    test("should rm each package directory", async () => {
        const rmMock = jest.spyOn(fs.promises, "rm").mockClear().mockResolvedValue();
        const i = { ...validProdInstall, packages: [...packages] };
        await removePackages(packages, i, nodecgIODir);

        expect(rmMock).toHaveBeenCalledTimes(2);
        const rmOpts = { recursive: true, force: true };
        expect(rmMock).toHaveBeenCalledWith(path.join(nodecgIODir, corePkg.path), rmOpts);
        expect(rmMock).toHaveBeenLastCalledWith(path.join(nodecgIODir, twitchChatPkg.path), rmOpts);
        expect(i.packages.length).toBe(0);
    });

    test("should write install.json after each removal", async () => {
        const i = { ...validProdInstall, packages: [...packages] };
        await removePackages(packages, i, nodecgIODir);
        expect(writeInstallInfoMock).toHaveBeenCalledTimes(2);
        expect(writeInstallInfoMock).toHaveBeenLastCalledWith(nodecgIODir, { ...validProdInstall, packages: [] });
    });
});

describe("installPackages", () => {
    // We need to replace packages with a new empty array each time because this is a shallow copy
    // and the packages array would be reused over each test
    const createInstall = () => ({ ...validProdInstall, packages: [] });
    const downloadMock = jest.spyOn(npm, "downloadNpmPackage").mockResolvedValue();
    const npmInstallMock = jest.spyOn(npm, "runNpmInstall").mockResolvedValue();

    test("should fetch packages from npm", async () => {
        const i = createInstall();
        await installPackages(packages, i, nodecgIODir);

        expect(i.packages).toStrictEqual(packages);
        expect(downloadMock).toHaveBeenCalledTimes(packages.length);
        packages.forEach((pkg) => expect(downloadMock).toHaveBeenCalledWith(pkg, nodecgIODir));
    });

    test("should include all packages in npm workspace", async () => {
        await installPackages(packages, createInstall(), nodecgIODir);

        const packageJsonBuf = await vol.promises.readFile(path.join(nodecgIODir, "package.json"));
        const packageJson = JSON.parse(packageJsonBuf.toString());
        expect(packageJson["workspaces"]).toStrictEqual(packages.map((p) => p.path));
    });

    test("should install prod dependencies", async () => {
        await installPackages(packages, createInstall(), nodecgIODir);
        expect(npmInstallMock).toHaveBeenCalled();
        expect(npmInstallMock).toHaveBeenCalledWith(nodecgIODir, true);
    });

    test("should revert changes if npm install fails", async () => {
        npmInstallMock.mockRejectedValue(new Error("random error"));
        const rmMock = jest.spyOn(fs.promises, "rm").mockClear().mockResolvedValue();

        // should return the error
        await expect(installPackages(packages, createInstall(), nodecgIODir)).rejects.toThrow("random error");

        // should revert install by deleting added packages
        expect(rmMock).toHaveBeenCalledTimes(packages.length);

        // for the other tests it needs to resolve again and not create an error
        npmInstallMock.mockReset().mockResolvedValue();
    });

    test("should write install.json when finishing successfully", async () => {
        await installPackages(packages, createInstall(), nodecgIODir);
        expect(writeInstallInfoMock).toHaveBeenCalled();
        expect(writeInstallInfoMock).toHaveBeenCalledWith(nodecgIODir, { ...validProdInstall, packages: packages });
    });
});

describe("validateInstall", () => {
    const directoryExistsMock = jest.spyOn(fsUtils, "directoryExists");
    afterEach(() => directoryExistsMock.mockReset());

    test("should remove packages in package list if package dir does not exist", async () => {
        directoryExistsMock.mockResolvedValue(false);
        const i = { ...validProdInstall, packages: [...packages] };
        await validateInstall(i, nodecgIODir);
        expect(i.packages).toStrictEqual([]);
    });

    test("should keep packages in package list if package dir exists", async () => {
        directoryExistsMock.mockResolvedValue(true);
        const i = { ...validProdInstall, packages: [...packages] };
        await validateInstall(i, nodecgIODir);
        expect(i.packages).toStrictEqual(packages);
    });
});
