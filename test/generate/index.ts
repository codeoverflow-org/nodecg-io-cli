import { vol } from "memfs";
import { corePkg, fsRoot, nodecgPackageJsonStr, twitchChatPkg, validDevInstall, validProdInstall } from "../test.util";
import { SemVer } from "semver";
import * as path from "path";
import * as installation from "../../src/utils/installation";
import * as fsUtils from "../../src/utils/fs";
import * as npm from "../../src/utils/npm";
import { ensureValidInstallation, generateBundle } from "../../src/generate";
import { GenerationOptions } from "../../src/generate/prompt";
import { defaultOpts, jsOpts } from "./opts.util";
import { developmentPublishRootUrl } from "../../src/generate/packageJson";
import { Installation } from "../../src/utils/installation";

const nodecgPackageJsonPath = path.join(fsRoot, "package.json");
const packageJsonPath = path.join(defaultOpts.bundlePath, "package.json");

jest.spyOn(installation, "readInstallInfo").mockResolvedValue(validProdInstall);
jest.spyOn(fsUtils, "executeCommand").mockResolvedValue();
jest.spyOn(npm, "getLatestPackageVersion").mockResolvedValue(new SemVer("1.2.3"));

jest.mock("fs", () => vol);
afterEach(() => vol.reset());
beforeEach(async () => {
    await vol.promises.mkdir(defaultOpts.bundleDir);
    await vol.promises.mkdir(defaultOpts.bundlePath);
    await vol.promises.writeFile(nodecgPackageJsonPath, nodecgPackageJsonStr);
});

describe("ensureValidInstallation", () => {
    test("should not throw when passing install capable of generating bundles", () => {
        expect(ensureValidInstallation(validProdInstall)).toBe(true);
    });

    test("should throw when passing undefined", () => {
        expect(() => ensureValidInstallation(undefined)).toThrow("not installed");
    });

    test("should throw when passing install with no services", () => {
        expect(() => ensureValidInstallation({ ...validProdInstall, packages: [corePkg] })).toThrow(
            "at least one service",
        );
    });
});

describe("generateBundle", () => {
    test("should fail if bundle directory already contains files", async () => {
        // Create some file inside the directory in which the bundle would be generated.
        await vol.promises.writeFile(packageJsonPath, "");
        await expect(generateBundle(defaultOpts, validProdInstall)).rejects.toThrow(
            "already exists and contains files",
        );
    });

    test("should install dependencies", async () => {
        const installMock = jest.spyOn(npm, "runNpmInstall").mockResolvedValue();
        await generateBundle(defaultOpts, validProdInstall);

        expect(installMock).toHaveBeenCalled();
        expect(installMock).toHaveBeenCalledWith(defaultOpts.bundlePath, false);
    });

    test("should run build if typescript", async () => {
        const buildMock = jest.spyOn(npm, "runNpmBuild").mockClear().mockResolvedValue();
        await generateBundle(defaultOpts, validProdInstall);
        expect(buildMock).toHaveBeenCalledTimes(1);
        expect(buildMock).toHaveBeenCalledWith(defaultOpts.bundlePath);
    });

    test("should not run build if javascript", async () => {
        const buildMock = jest.spyOn(npm, "runNpmBuild").mockClear().mockResolvedValue();
        await generateBundle(jsOpts, validProdInstall);
        expect(buildMock).toHaveBeenCalledTimes(0);
    });
});

describe("genPackageJson", () => {
    // We don't have a good type for a package.json and this is only testing code so this should be fine.
    async function genPackageJSON(
        opts: GenerationOptions = defaultOpts,
        install: Installation = validProdInstall,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        await generateBundle(opts, install);
        const packageJsonStr = await vol.promises.readFile(packageJsonPath);
        if (!packageJsonStr) throw new Error("package.json does not exist");
        return JSON.parse(packageJsonStr.toString());
    }

    test("should have correct basic information", async () => {
        const packageJson = await genPackageJSON();

        expect(packageJson["name"]).toBe(defaultOpts.bundleName);
        expect(packageJson["version"]).toBe(defaultOpts.version.toString());
        expect(packageJson["nodecg"]["compatibleRange"]).toBeDefined();
        expect(packageJson["nodecg"]["bundleDependencies"][twitchChatPkg.name]).toBe(`^${twitchChatPkg.version}`);
    });

    test("should have only nodecg-io-core dependency if javascript", async () => {
        const deps = (await genPackageJSON(jsOpts))["dependencies"];

        expect(Object.keys(deps).length).toBe(1);
        expect(Object.entries(deps)[0]).toStrictEqual([corePkg.name, `^${corePkg.version}`]);
    });

    test("should have all required typing packages as dependency if typescript", async () => {
        const deps = (await genPackageJSON(defaultOpts))["dependencies"];
        const e = Object.entries(deps);
        expect(e).toEqual(expect.arrayContaining([[twitchChatPkg.name, `^${twitchChatPkg.version}`]]));

        // These dependencies should always have the latest version which is fetched by the mocked getLatestPackageVersion
        // And nodecg should be the version of the NodeCG install
        expect(e).toEqual(expect.arrayContaining([["typescript", `^1.2.3`]]));
        expect(e).toEqual(expect.arrayContaining([["@types/node", `^1.2.3`]]));
        expect(e).toEqual(expect.arrayContaining([["nodecg", `^${defaultOpts.nodeCGVersion}`]]));
    });

    test("should get dependencies using tarballs if a development install is used", async () => {
        const deps = (await genPackageJSON(defaultOpts, validDevInstall))["dependencies"];

        expect(deps["nodecg-io-core"]).toContain(developmentPublishRootUrl);
    });

    test("should use nodecg-types for 0.2", async () => {
        const install = {
            ...validProdInstall,
            version: "0.2",
        };
        const deps = (await genPackageJSON(defaultOpts, install))["dependencies"];

        // These dependencies should always have the latest version which is fetched by the mocked getLatestPackageVersion
        expect(deps["nodecg-types"]).toBe("^1.2.3");
    });

    // TODO: seperate in 0.3 and dev once 0.3 has been released and added
    test("should use nodecg-types for 0.3 or higher/dev if NodeCG v1", async () => {
        const opts = {
            ...defaultOpts,
            nodeCGVersion: new SemVer("1.9.0"),
        };
        const deps = (await genPackageJSON(opts, validDevInstall))["dependencies"];

        // These dependencies should always have the latest version which is fetched by the mocked getLatestPackageVersion
        expect(deps["nodecg-types"]).toBe("^1.2.3");
    });

    test("should use @nodecg/types for 0.3 or higher/dev if NodeCG v2", async () => {
        const opts = {
            ...defaultOpts,
            nodeCGVersion: new SemVer("2.1.0"),
        };
        const deps = (await genPackageJSON(opts, validDevInstall))["dependencies"];
        expect(deps["@nodecg/types"]).toBeDefined();
        expect(deps["@nodecg/types"]).toBe("^2.1.0"); // Should be same version as NodeCG
    });

    test("should have build scripts if typescript", async () => {
        const packageJson = await genPackageJSON(defaultOpts);
        expect(packageJson["scripts"]).toBeDefined();
        expect(Object.keys(packageJson["scripts"])).toStrictEqual(["build", "watch", "clean"]);
    });

    test("should have no build scripts if javascript", async () => {
        const packageJson = await genPackageJSON(jsOpts);
        expect(packageJson["scripts"]).toBeUndefined();
    });

    test("should generate graphic if graphic is enabled", async () => {
        const packageJson = await genPackageJSON({ ...defaultOpts, graphic: true });
        expect(packageJson["nodecg"]["graphics"]).toBeDefined();
        expect(packageJson["nodecg"]["graphics"].length).toBe(1);
    });

    test("should generate dashboard if dashboard is enabled", async () => {
        const packageJson = await genPackageJSON({ ...defaultOpts, dashboard: true });
        expect(packageJson["nodecg"]["dashboardPanels"]).toBeDefined();
        expect(packageJson["nodecg"]["dashboardPanels"].length).toBe(1);
    });
});
