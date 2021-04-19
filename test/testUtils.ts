import * as temp from "temp";

temp.track();
afterEach(() => temp.cleanup());

/**
 * The root directory of memfs. Differs on unix-like and windows systems.
 */
export const fsRoot = process.platform === "win32" ? "D:\\" : "/";

export function tempDir(): Promise<string> {
    return temp.mkdir("nodecg-io-cli-test");
}
