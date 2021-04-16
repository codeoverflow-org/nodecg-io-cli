/**
 * The root directory of memfs. Differs on unix-like and windows systems.
 */
export const fsRoot = process.platform === "win32" ? "D:\\" : "/";
