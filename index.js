#!/usr/bin/env node

// This is the main entry point of the cli which just imports src/index.ts
// This is a extra file because the typescript compiler always unsets the executable flag
// but the entrypoint needs to be executable so we can't have it in src/index.ts directly
// because the resulting file won't have the executable flag and you can't properly use it that way.

require("./build/src/index");