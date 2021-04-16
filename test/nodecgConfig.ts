import { vol } from "memfs";
import { fsRoot } from "./testUtils";
import { manageBundleDir, readNodeCGConfig, writeNodeCGConfig } from "../src/nodecgConfig";
import * as path from "path";

jest.mock("fs", () => vol);
afterEach(() => vol.reset());

const exampleConfig = {
    bundles: {
        paths: ["some-custom-bundle-dir"],
        disabled: ["nodecg-io-debug"],
    },
    developer: true,
    logging: {
        console: {
            level: "trace",
        },
    },
};

const configDir = path.join(fsRoot, "cfg");
const configPath = path.join(configDir, "nodecg.json");

describe("readNodeCGConfig", () => {
    test("should return undefined if config is not already existing", async () => {
        await expect(readNodeCGConfig(fsRoot)).resolves.toBeUndefined();
    });

    test("should read config if existing", async () => {
        await vol.promises.mkdir(configDir);
        await vol.promises.writeFile(configPath, JSON.stringify(exampleConfig));

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(exampleConfig);
    });
});

describe("writeNodeCGConfig", () => {
    test("should write config and create dirs if needed", async () => {
        // the /cfg directory does not exist and must be created by writeNodeCGConfig
        await writeNodeCGConfig(fsRoot, exampleConfig);
        const content = await vol.promises.readFile(configPath);
        const json = JSON.parse(content.toString());
        expect(json).toStrictEqual(exampleConfig);
    });
});

describe("manageBundleDir", () => {
    // Example config on memfs is modified by tests and thus needs to be written to it
    beforeEach(async () => {
        await writeNodeCGConfig(fsRoot, exampleConfig);
    });

    test("should be able add bundle entry from nodecg config", async () => {
        await manageBundleDir(fsRoot, "nodecg-io", true);

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual({
            ...exampleConfig,
            bundles: {
                ...exampleConfig.bundles,
                paths: ["some-custom-bundle-dir", "nodecg-io"],
            },
        });
    });

    test("should be able to remove bundle dir entry", async () => {
        await manageBundleDir(fsRoot, "some-custom-bundle-dir", false);

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual({
            ...exampleConfig,
            bundles: {
                ...exampleConfig.bundles,
                paths: [],
            },
        });
    });

    test("should do nothing if bundle dir was already added", async () => {
        await manageBundleDir(fsRoot, "some-custom-bundle-dir", true); // that is already in there

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(exampleConfig);
    });

    test("should do nothing if bundle dir was already removed", async () => {
        await manageBundleDir(fsRoot, "nodecg-io", false); // nodecg-io isn't in it already

        await expect(readNodeCGConfig(fsRoot)).resolves.toStrictEqual(exampleConfig);
    });
});
