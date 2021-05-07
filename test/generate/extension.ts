import { vol } from "memfs";
import * as path from "path";
import { defaultOpts, jsOpts } from "./opts.util";
import { genExtension } from "../../src/generate/extension";
import { validProdInstall } from "../test.util";

jest.mock("fs", () => vol);
beforeEach(() => vol.promises.mkdir(defaultOpts.bundlePath, { recursive: true }));
afterEach(() => vol.reset());

describe("genExtension", () => {
    const extensionDirPath = path.join(defaultOpts.bundlePath, "extension");
    function checkExtFile(name: string, existing: boolean) {
        expect(vol.existsSync(path.join(extensionDirPath, name))).toBe(existing);
    }

    test("should generate a .ts file if typescript", async () => {
        await genExtension(defaultOpts, validProdInstall);
        checkExtFile("index.ts", true);
        checkExtFile("index.js", false);
    });

    test("should generate a .js file if javascript", async () => {
        await genExtension(jsOpts, validProdInstall);
        checkExtFile("index.ts", false);
        checkExtFile("index.js", true);
    });
});
