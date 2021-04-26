import { AxiosRequestConfig, AxiosPromise } from "axios";
import { getHighestPatchVersion, getMinorVersions, getPackageVersions } from "../../src/npm";
import { corePkg, invalidPkgName } from "../testUtils";

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

    if (url?.endsWith(corePkg.name)) {
        // core (for testing purposes valid) => return valid info
        return Promise.resolve({
            status: 200,
            statusText: "OK",
            data: fakeCoreNpmResponse,
            headers: undefined,
            config: {},
        });
    } else {
        // invalid package => 404
        return Promise.reject(new Error("Request failed with status code 404"));
    }
}

describe("getPackageVersions", () => {
    test("should return all versions", async () => {
        await expect(getPackageVersions(corePkg.name)).resolves.toStrictEqual(versions);
    });

    test("should error when requesting versions of invalid package", async () => {
        await expect(getPackageVersions(invalidPkgName)).rejects.toThrowError();
    });
});

describe("getMinorVersions", () => {
    test("should give de-duplicated minor versions", async () => {
        await expect(getMinorVersions(corePkg.name)).resolves.toStrictEqual(["0.1", "0.2"]);
    });
});

describe("getHighestPatchVersion", () => {
    test("should return the highest version of the passed minor version", async () => {
        await expect(getHighestPatchVersion(corePkg.name, "0.1")).resolves.toStrictEqual("0.1.2");
        await expect(getHighestPatchVersion(corePkg.name, "0.2")).resolves.toStrictEqual("0.2.0");
    });
});
