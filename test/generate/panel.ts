import { vol } from "memfs";
import * as path from "path";
import { defaultOpts } from "./opts.util";
import { genDashboard, genGraphic } from "../../src/generate/panel";

jest.mock("fs", () => vol);
beforeEach(() => vol.promises.mkdir(defaultOpts.bundlePath, { recursive: true }));
afterEach(() => vol.reset());

describe("genGraphic", () => {
    const graphicPath = path.join(defaultOpts.bundlePath, "graphics", "index.html");
    test("should generate a graphic html file if wanted", async () => {
        await genGraphic({ ...defaultOpts, graphic: true });
        expect(vol.existsSync(graphicPath)).toBe(true);
    });

    test("should generate no file if not wanted", async () => {
        await genGraphic(defaultOpts);
        expect(vol.existsSync(graphicPath)).toBe(false);
    });
});

describe("genDashboard", () => {
    const dashboardPath = path.join(defaultOpts.bundlePath, "dashboard", "panel.html");
    test("should generate a dashboard html file if wanted", async () => {
        await genDashboard({ ...defaultOpts, dashboard: true });
        expect(vol.existsSync(dashboardPath)).toBe(true);
    });

    test("should generate no file if not wanted", async () => {
        await genDashboard(defaultOpts);
        expect(vol.existsSync(dashboardPath)).toBe(false);
    });
});
