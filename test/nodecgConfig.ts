import { vol } from "memfs";
import { fsRoot, cfgDir, nodecgCfgPath, nodecgExampleConfig } from "./testUtils";
import { manageBundleDir, readNodeCGConfig, writeNodeCGConfig } from "../src/nodecgConfig";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

describe("readNodeCGConfig", () => {
    test("should return undefined if config is not already existing", async () => {
        await expect(readNodeCGConfig(fsRoot)).resolves.toBeUndefined();
    });

    test("should read config if existing", async () => {
        await vol.promises.mkdir(cfgDir);
        await vol.promises.writeFile(nodecgCfgPath, JSON.stringify(nodecgExampleConfig));

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(nodecgExampleConfig);
    });
});

describe("writeNodeCGConfig", () => {
    test("should write config and create dirs if needed", async () => {
        // the /cfg directory does not exist and must be created by writeNodeCGConfig
        await writeNodeCGConfig(fsRoot, nodecgExampleConfig);
        const content = await vol.promises.readFile(nodecgCfgPath);
        const json = JSON.parse(content.toString());
        expect(json).toStrictEqual(nodecgExampleConfig);
    });
});

describe("manageBundleDir", () => {
    // Example config on memfs is modified by tests and thus needs to be written to it
    beforeEach(async () => {
        await writeNodeCGConfig(fsRoot, nodecgExampleConfig);
    });

    test("should be able add bundle entry from nodecg config", async () => {
        await manageBundleDir(fsRoot, "nodecg-io", true);

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual({
            ...nodecgExampleConfig,
            bundles: {
                ...nodecgExampleConfig.bundles,
                paths: ["some-custom-bundle-dir", "nodecg-io"],
            },
        });
    });

    test("should be able to remove bundle dir entry", async () => {
        await manageBundleDir(fsRoot, "some-custom-bundle-dir", false);

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual({
            ...nodecgExampleConfig,
            bundles: {
                ...nodecgExampleConfig.bundles,
                paths: [],
            },
        });
    });

    test("should do nothing if bundle dir was already added", async () => {
        await manageBundleDir(fsRoot, "some-custom-bundle-dir", true); // that is already in there

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(nodecgExampleConfig);
    });

    test("should do nothing if bundle dir was already removed", async () => {
        await manageBundleDir(fsRoot, "nodecg-io", false); // nodecg-io isn't in it already

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(nodecgExampleConfig);
    });
});
