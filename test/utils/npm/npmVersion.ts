import * as child_process from "child_process";
import { ExecException } from "child_process";
import { getNpmVersion, requireNpmV7 } from "../../../src/utils/npm";
import { oldNpmVersion, validNpmVersion } from "../../test.util";

function createExecMock(versionValue: string | undefined) {
    const execSpy = jest.spyOn(child_process, "exec");

    const impl = (_command: string, cb: (error: ExecException | null, stdout: string) => void) => {
        setImmediate(() => {
            if (versionValue) {
                cb(null, versionValue);
            } else {
                cb(
                    {
                        code: 1,
                        message: "not found",
                        name: "not found",
                    },
                    "",
                );
            }
        });

        return {
            exitCode: versionValue ? 0 : 1,
        };
    };

    return execSpy.mockImplementation(impl as never);
}

describe("getNpmVersion", () => {
    test("should return correct version", async () => {
        createExecMock(validNpmVersion);
        const ver = await getNpmVersion();
        expect(ver?.version).toBe(validNpmVersion);
    });

    test("should call npm --version to get version", async () => {
        const execSpy = createExecMock(validNpmVersion);
        await getNpmVersion();
        expect(execSpy).toHaveBeenCalled();
        expect(execSpy.mock.calls[0][0]).toBe("npm --version");
    });

    test("should return undefined if npm is not installed", async () => {
        createExecMock(undefined);
        await expect(getNpmVersion()).resolves.toBeUndefined();
    });
});

describe("requireNpmV7", () => {
    test("should say that npm is not installed if version is undefined", async () => {
        createExecMock(undefined);
        await expect(requireNpmV7()).rejects.toThrow("not find npm");
    });

    test("should say version is too low when version is <7", async () => {
        createExecMock(oldNpmVersion);
        await expect(requireNpmV7()).rejects.toThrow("7.0.0 or higher");
        await expect(requireNpmV7()).rejects.toThrow("have " + oldNpmVersion);
    });

    test("should not throw anything if version is >=7", async () => {
        createExecMock(validNpmVersion);
        await requireNpmV7();
    });
});
