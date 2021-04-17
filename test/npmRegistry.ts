import { AxiosPromise } from "axios";
import { getHighestPatchVersion, getMinorVersions, getPackageVersions } from "../src/npm";

const packageName = "nodecg-io-core";
const versions = ["0.1.0", "0.1.1", "0.1.2", "0.2.0"];

// Very bare-bones version of a real response, we just add fake data that we are using for testing, not everything.
const fakeNpmResponse = {
    name: "nodecg-io-core",
    "dist-tags": {
        latest: "0.2.0",
    },
    versions: Object.fromEntries(versions.map((v) => [v, {}])),
};

jest.mock("axios", () => ({ default: handleAxiosNpmRequest }));

function handleAxiosNpmRequest(): AxiosPromise<typeof fakeNpmResponse> {
    return Promise.resolve({
        status: 200,
        statusText: "OK",
        data: fakeNpmResponse,
        headers: undefined,
        config: {},
    });
}

test("getPackageVersions should give all versions", async () => {
    await expect(getPackageVersions(packageName)).resolves.toStrictEqual(versions);
});

test("getMinorVersions should give de-duplicated minor versions", async () => {
    await expect(getMinorVersions(packageName)).resolves.toStrictEqual(["0.1", "0.2"]);
});

test("getHighestPatchVersion should return the highest version of the passed minor version", async () => {
    await expect(getHighestPatchVersion(packageName, "0.1")).resolves.toStrictEqual("0.1.2");
    await expect(getHighestPatchVersion(packageName, "0.2")).resolves.toStrictEqual("0.2.0");
});
