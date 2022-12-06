import { vol } from "memfs";
import { genTsConfig } from "../../src/generate/tsConfig.js";
import { defaultOpts, jsOpts } from "./opts.util.js";
import * as path from "path";

jest.mock("fs", () => vol);
beforeEach(() => vol.promises.mkdir(defaultOpts.bundlePath, { recursive: true }));
afterEach(() => vol.reset());

const tsConfigPath = path.join(defaultOpts.bundlePath, "tsconfig.json");

describe("genTsConfig", () => {
    test("should generate tsconfig if typescript", async () => {
        await genTsConfig(defaultOpts);
        expect(vol.existsSync(tsConfigPath)).toBe(true);
    });

    test("should not generate tsconfig if javascript", async () => {
        await genTsConfig(jsOpts);
        expect(vol.existsSync(tsConfigPath)).toBe(false);
    });
});
