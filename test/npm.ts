import { AxiosPromise, AxiosRequestConfig } from "axios";
import {
    getHighestPatchVersion,
    getMinorVersions,
    getPackageVersions,
    removeNpmPackage,
    createNpmPackageReadStream,
    extractNpmPackageTar,
} from "../src/npm";
import { tempDir } from "./testUtils";
import { promises as fs } from "fs";
import * as path from "path";
import * as fsUtils from "../src/fsUtils";

const validPkgName = "nodecg-io-core";
const invalidPkgName = "something-hopefully-invalid";
const pkg = {
    name: validPkgName,
    path: validPkgName,
    version: "0.1.0",
};
const versions = ["0.1.0", "0.1.1", "0.1.2", "0.2.0"];

// Very bare-bones version of a real response, we just add fake data that we are using for testing, not everything.
const fakeCoreNpmResponse = {
    name: "nodecg-io-core",
    "dist-tags": {
        latest: "0.2.0",
    },
    versions: Object.fromEntries(versions.map((v) => [v, {}])),
};

jest.mock("axios", () => ({ default: handleAxiosNpmRequest }));

function handleAxiosNpmRequest(opts: string | AxiosRequestConfig): AxiosPromise<unknown> {
    const url = typeof opts === "string" ? opts : opts.url;
    if (url?.endsWith(".tgz")) {
        // We're requesting a tarball of a package, this is currently not mocked and thus we will forward the request
        // to axios to actually get it from the npm registry.
        return jest.requireActual("axios")(opts);
    } else {
        // We're requesting information about a package, which we do mock.
        if (url?.endsWith(validPkgName)) {
            return Promise.resolve({
                status: 200,
                statusText: "OK",
                data: fakeCoreNpmResponse,
                headers: undefined,
                config: {},
            });
        } else {
            // invalid package should result in a 404
            return Promise.reject(new Error("Request failed with status code 404"));
        }
    }
}

describe("getPackageVersions", () => {
    test("should return all versions", async () => {
        await expect(getPackageVersions(validPkgName)).resolves.toStrictEqual(versions);
    });

    test("should error when requesting versions of invalid package", async () => {
        await expect(getPackageVersions(invalidPkgName)).rejects.toThrowError();
    });
});

describe("getMinorVersions", () => {
    test("should give de-duplicated minor versions", async () => {
        await expect(getMinorVersions(validPkgName)).resolves.toStrictEqual(["0.1", "0.2"]);
    });
});

describe("getHighestPatchVersion", () => {
    test("should return the highest version of the passed minor version", async () => {
        await expect(getHighestPatchVersion(validPkgName, "0.1")).resolves.toStrictEqual("0.1.2");
        await expect(getHighestPatchVersion(validPkgName, "0.2")).resolves.toStrictEqual("0.2.0");
    });
});

describe("createNpmPackageReadStream", () => {
    test("should successfully create read stream for valid package", async () => {
        expect(createNpmPackageReadStream(pkg)).resolves.toBeDefined();
    });

    test("should error if package name is invalid", async () => {
        await expect(
            createNpmPackageReadStream({
                ...pkg,
                name: invalidPkgName,
            }),
        ).rejects.toThrow("404");
    });

    test("should error if package version is invalid", async () => {
        await expect(
            createNpmPackageReadStream({
                ...pkg,
                version: "0.0.1",
            }),
        ).rejects.toThrow("404");
    });
});

describe("downloadNpmPackage", () => {
    test("should be able to fetch valid version and redirect /package/* content", async () => {
        const d = await tempDir();

        const tarStream = await createNpmPackageReadStream(pkg);
        await extractNpmPackageTar(pkg, tarStream, d);

        // Make sure that it redirects everything from /package/* to /*
        const packageJsonBuf = await fs.readFile(path.join(d, validPkgName, "package.json"));
        const packageJson = JSON.parse(packageJsonBuf.toString());
        expect(packageJson["name"]).toBe(validPkgName);
    });
});

describe("removeNpmPackage", () => {
    test("should call to fsUtils.removeDirectory", async () => {
        const spy = jest.spyOn(fsUtils, "removeDirectory").mockResolvedValue();
        await removeNpmPackage(pkg, await tempDir());
        expect(spy).toHaveBeenCalled();
    });
});
