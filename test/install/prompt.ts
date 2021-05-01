import * as npm from "../../src/utils/npm";
import * as semver from "semver";
import { getCompatibleVersions, buildPackageList, getServicesFromInstall } from "../../src/install/prompt";
import { logger } from "../../src/utils/log";
import { corePackages, dashboardPackage, dashboardPath } from "../../src/nodecgIOVersions";
import { ProductionInstallation } from "../../src/utils/installation";
import { corePkg, twitchChatPkg } from "../testUtils";

describe("getCompatibleVersions", () => {
    const mock = jest.spyOn(npm, "getMinorVersions").mockResolvedValue(["0.1", "0.2", "1.0", "1.1"]);
    const compatibleRange = new semver.Range("<=0.2");
    afterAll(() => mock.mockReset());

    test("should only return versions that are compatible", () => {
        return expect(getCompatibleVersions(compatibleRange)).resolves.toStrictEqual(["0.1", "0.2"]);
    });

    test("should log which versions are incompatible", async () => {
        const spy = jest.spyOn(logger, "warn");
        await getCompatibleVersions(compatibleRange);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toContain("Cannot install");
        expect(spy.mock.calls[0][0]).toContain("1.0, 1.1");
    });
});

describe("buildPackageList", () => {
    const ver = "0.1";
    const testSvcName = "testSvc";
    const testSvcPkgName = `nodecg-io-${testSvcName}`;
    const mock = jest.spyOn(npm, "getHighestPatchVersion").mockResolvedValue("0.1.1");
    afterAll(() => mock.mockReset());

    let packages: npm.NpmPackage[];
    beforeAll(async () => {
        packages = await buildPackageList(ver, [testSvcName]);
    });

    test("should include core packages", async () => {
        corePackages.forEach((c) => {
            expect(packages.find((pkg) => pkg.name === c)).toBeTruthy();
        });
    });

    test("should have correct path for dashboard", async () => {
        expect(packages.find((pkg) => pkg.name === dashboardPackage)?.path).toBe(dashboardPath);
    });

    test("should have highest version for each package", async () => {
        // This makes that it uses getHighestPatchVersion to get the highest possible version of each package
        expect(packages.every((pkg) => pkg.version === "0.1.1")).toBe(true);
    });

    test("should include service packages", async () => {
        const testSvc = packages.find((pkg) => pkg.name === testSvcPkgName);
        expect(testSvc).toBeDefined();
    });
});

describe("getServicesFromInstall", () => {
    const install: ProductionInstallation = {
        dev: false,
        version: "0.1.0",
        packages: [
            {
                ...corePkg,
                version: "0.0.2",
            },
            {
                name: dashboardPackage,
                version: "0.0.2",
                path: dashboardPath,
            },
            {
                ...twitchChatPkg,
                version: "0.0.1",
            },
            {
                name: "nodecg-io-testSvc",
                version: "0.0.1",
                path: "nodecg-io-testSvc",
            },
        ],
    };
    const services = getServicesFromInstall(install, "0.1");

    test("should not return core packages", () => {
        expect(services.includes("core")).toBeFalsy();
        expect(services.includes("dashboard")).toBeFalsy();
    });

    test("should return packages that are available in the current version", () => {
        expect(services.includes("twitch-chat")).toBeTruthy();
    });

    test("should not return packages that are not available in the current version", () => {
        expect(services.includes("testSvc")).toBeFalsy();
    });
});
