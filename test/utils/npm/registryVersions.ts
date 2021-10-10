import { AxiosRequestConfig, AxiosPromise, AxiosResponse } from "axios";
import {
    getHighestPatchVersion,
    getLatestPackageVersion,
    getMinorVersions,
    getPackageVersions,
} from "../../../src/utils/npm";
import { corePkg, invalidPkgName, twitchChatPkg } from "../../test.util";
import { SemVer } from "semver";

const versions = ["0.1.0", "0.1.1", "0.1.2", "0.2.0"];

// Very bare-bones version of a real response, we just add fake data that we are using for testing, not everything.
const fakeCoreNpmResponseData = {
    name: corePkg.name,
    "dist-tags": {
        latest: "0.2.0",
    },
    versions: Object.fromEntries(versions.map((v) => [v, {}])),
};

// Test for a unpublished package (here twitch-chat)
const fakeTwitchNpmResponseData = {
    name: twitchChatPkg.name,
    // oh no, there is no version field here
};

const fakeCoreNpmResponse: AxiosResponse<typeof fakeCoreNpmResponseData> = {
    status: 200,
    statusText: "OK",
    data: fakeCoreNpmResponseData,
    headers: {},
    config: {},
};

jest.mock("axios", () => ({ default: handleAxiosNpmRequest }));

function handleAxiosNpmRequest(opts: string | AxiosRequestConfig): AxiosPromise<unknown> {
    const url = typeof opts === "string" ? opts : opts.url;

    if (url?.endsWith(corePkg.name)) {
        // core (for testing purposes valid) => return valid info
        return Promise.resolve(fakeCoreNpmResponse);
    } else if (url?.endsWith(twitchChatPkg.name)) {
        // unpublished version => don't return versions field
        return Promise.resolve({
            ...fakeCoreNpmResponse,
            data: fakeTwitchNpmResponseData,
        });
    } else {
        // invalid package => 404
        return Promise.reject(new Error("Request failed with status code 404"));
    }
}

describe("getPackageVersions", () => {
    test("should return all versions", async () => {
        const toStr = (semverList: SemVer[]) => semverList.map((s) => s.version);
        await expect(getPackageVersions(corePkg.name).then(toStr)).resolves.toStrictEqual(versions);
    });

    test("should error when requesting versions of invalid package", async () => {
        await expect(getPackageVersions(invalidPkgName)).rejects.toThrowError();
    });

    test("should error when requesting versions of a unpublished package", async () => {
        await expect(getPackageVersions(twitchChatPkg.name)).rejects.toThrowError("no published version");
    });
});

describe("getMinorVersions", () => {
    test("should give de-duplicated minor versions", async () => {
        await expect(getMinorVersions(corePkg.name)).resolves.toStrictEqual(["0.1", "0.2"]);
    });
});

describe("getHighestPatchVersion", () => {
    test("should return the highest version of the passed minor version", async () => {
        await expect(getHighestPatchVersion(corePkg.name, "0.1")).resolves.toStrictEqual(new SemVer("0.1.2"));
        await expect(getHighestPatchVersion(corePkg.name, "0.2")).resolves.toStrictEqual(new SemVer("0.2.0"));
    });
});

describe("getLatestPackageVersion", () => {
    test("should return latest version from latest dist-tag", async () => {
        await expect(getLatestPackageVersion(corePkg.name)).resolves.toStrictEqual(new SemVer("0.2.0"));
    });

    test("should error when requesting version from nonexistent package", async () => {
        await expect(getLatestPackageVersion(invalidPkgName)).rejects.toThrow("404");
    });
});
