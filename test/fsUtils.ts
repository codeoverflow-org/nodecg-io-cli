import { vol } from "memfs";
import { directoryExists, ensureDirectory } from "../src/fsUtils";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

const testDir = "/testDir";

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
