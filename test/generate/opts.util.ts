import { GenerationOptions, PromptedGenerationOptions } from "../../src/generate/prompt";
import * as path from "path";
import { corePkg, fsRoot, twitchChatPkg } from "../test.util";
import { SemVer } from "semver";

export const defaultOptsPrompt: PromptedGenerationOptions = {
    bundleName: "test-bundle",
    bundleDir: path.join(fsRoot, "bundles"),
    description: "Hello, this is a description for a test bundle.",
    version: new SemVer("0.1.0"),
    services: [twitchChatPkg.path.replace("nodecg-io-", "")],
    language: "typescript",
    graphic: false,
    dashboard: false,
};

export const defaultOpts: GenerationOptions = {
    ...defaultOptsPrompt,
    servicePackages: [twitchChatPkg],
    corePackage: corePkg,
    nodeCGVersion: new SemVer("2.0.0"),
    bundlePath: path.join(fsRoot, "bundles", "test-bundle"),
};
export const jsOpts: GenerationOptions = { ...defaultOpts, language: "javascript" };
