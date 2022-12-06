import { vol } from "memfs";
import { directoryExists, ensureDirectory, executeCommand } from "../../src/utils/fs";
import * as child_process from "child_process";
import { testDir } from "../test.util";
import { logger } from "../../src/utils/log";

// FIXME: this only works with this mock that fakes child_process to be a es module. Don't know why, yet.
jest.mock("child_process", () => ({
    __esModule: true,
    ...(jest.requireActual("child_process") as object),
}));

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

describe("directoryExists", () => {
    test("should return false on non-existent directory", async () => {
        expect(await directoryExists(testDir)).toBe(false);
    });

    test("should return true on existent directory", async () => {
        await vol.promises.mkdir(testDir);
        expect(await directoryExists(testDir)).toBe(true);
    });

    test("should return false on file", async () => {
        await vol.promises.writeFile(testDir, "abc");
        expect(await directoryExists(testDir)).toBe(false);
    });
});

describe("ensureDirectory", () => {
    test("should create directory if non-existent", async () => {
        await ensureDirectory(testDir);
        const s = await vol.promises.stat(testDir);
        expect(s.isDirectory()).toBe(true);
    });

    test("should do nothing if directory exists", async () => {
        await vol.promises.mkdir(testDir);
        // Creating a already created directory would error, so this checks that the existence check is working
        await ensureDirectory(testDir);
        const s = await vol.promises.stat(testDir);
        expect(s.isDirectory()).toBe(true);
    });
});

describe("executeCommand", () => {
    test("should not error if the command successfully exits (code 0)", async () => {
        await executeCommand("exit", ["0"]);
    });

    test("should error if the command exits with a non-zero exit code", async () => {
        await expect(executeCommand("exit", ["1"])).rejects.toThrow("error code 1");
    });

    test("should error if command is invalid", async () => {
        await expect(executeCommand("someHopefullyInvalidCommand", [])).rejects.toThrow("error code 1"); // win: 1; unix 127
    });

    test("should inherit io streams", async () => {
        const spy = jest.spyOn(child_process, "spawn");
        await executeCommand("exit", ["0"]);
        expect(spy.mock.calls[0]?.[2].stdio).toBe("inherit");
    });

    test("should log the command that gets executed", async () => {
        const spy = jest.spyOn(logger, "info");
        await executeCommand("exit", ["0"]);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0]?.[0]).toContain("exit 0");
    });
});
