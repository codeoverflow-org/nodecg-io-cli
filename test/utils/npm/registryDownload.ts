import { createNpmPackageReadStream, downloadNpmPackage } from "../../../src/utils/npm";
import { corePkg, invalidPkgName, tempDir } from "../../test.util";
import { promises as fs } from "fs";
import * as path from "path";

describe("createNpmPackageReadStream", () => {
    test("should successfully create read stream for valid package", async () => {
        await expect(createNpmPackageReadStream(corePkg)).resolves.toBeDefined();
    });

    test("should error if package name is invalid", async () => {
        await expect(
            createNpmPackageReadStream({
                ...corePkg,
                name: invalidPkgName,
            }),
        ).rejects.toThrow("404");
    });

    test("should error if package version is invalid", async () => {
        await expect(
            createNpmPackageReadStream({
                ...corePkg,
                version: "0.0.1",
            }),
        ).rejects.toThrow("404");
    });
});

describe("downloadNpmPackage", () => {
    test("should be able to fetch valid version and redirect /package/* content", async () => {
        const d = await tempDir();

        await downloadNpmPackage(corePkg, d);

        // Make sure that it redirects everything from /package/* to /*
        const packageJsonBuf = await fs.readFile(path.join(d, corePkg.name, "package.json"));
        const packageJson = JSON.parse(packageJsonBuf.toString());
        expect(packageJson["name"]).toBe(corePkg.name);
    });
});
