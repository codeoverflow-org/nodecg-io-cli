# :warning: nodecg-io is abandoned
This project is no longer actively maintained and is archived.
The domain [nodecg.io](https://codeoverflow-org.github.io/nodecg-io-docs/RELEASE/) is also not available anymore.
Use this project at your own risk - breaking APIs and security vulnerabilities are expected to happen soon.
If you wish to continue nodecg-io, please fork it.
Similar projects may or may not happen in the future [here](https://github.com/sebinside).

<!-- Do not include the top level heading when generating the
     table of contents using the vscode markdown all in one extension -->
<!-- prettier-ignore-start -->
<!-- omit in toc -->
# nodecg-io-cli
<!-- prettier-ignore-end -->

This is the CLI for [nodecg-io](https://github.com/codeoverflow-org/nodecg-io) that allows you to easily manage your nodecg-io installation and helps you with nodecg-io related development.

## Table of contents

- [Table of contents](#table-of-contents)
- [Commands](#commands)
  - [`nodecg-io install`](#nodecg-io-install)
  - [`nodecg-io uninstall`](#nodecg-io-uninstall)
  - [`nodecg-io generate`](#nodecg-io-generate)
- [A note about versioning](#a-note-about-versioning)
- [Developer workflow](#developer-workflow)

---

## Commands

Here's a brief overview of the available commands. More in-depth usage guides of these commands will be available in the [nodecg-io docs](https://codeoverflow-org.github.io/nodecg-io-docs) at some point.

### `nodecg-io install`

Installs nodecg-io to your current NodeCG installation into a subdirectory called `nodecg-io`. Allows you to select which released version you want or if you wish to get a development install.

A production install fetches tarballs of the needed packages from the official npm registry, unpacks them, creates a `package.json` with all packages in a npm v7 workspace configuration and installs dependencies that way.

A development install clones the official git repository (`main`), installs dependencies builds all packages.

Either way at the end of the installation it will automatically add the nodecg-io directory (and samples if dev install and selected) to the `bundles.paths` array of your NodeCG configuration. If you don't have a NodeCG configuration it will create one for you.

If you later decide that you want to add or remove a service you can just re-run `nodecg-io install`. It saves your choices and makes them the default selected if you already have an installation, so you can make changes to them. If you re-run the `install` command it will also pull the repo and rebuild if necessary. In case of a development install and, in case of a production install, it will make any updates if some packages have a new patch version available. Updates of minor and major changes must be made explicitly by selecting the newer version when running the `install` command.

### `nodecg-io uninstall`

Undoes everything that `nodecg-io install` did. It removes the `nodecg-io` directory with your installation and removes nodecg-io from your NodeCG configuration.

### `nodecg-io generate`

Generates a new bundle in the `bundles/` directory in your NodeCG installation.
Allows you to decide on language (TypeScript or JavaScript), whether you want a dashboard/graphic and which services you want to use.
Uses your installed nodecg-io version and services, meaning you need to have the services that you want to use installed.

These generated bundles are only meant as a starting point, you may probably do more things like creating a git repository for your bundle,
add a licence, or add other tools like linters.

If you are using a released version of nodecg-io (aka. a production install) the nodecg-io packages get fetched directly from npm.
If you are using a development version of nodecg-io these get fetched as tarballs from the [nodecg-io-publish repository](https://github.com/codeoverflow-org/nodecg-io-publish).

## A note about versioning

This CLI follows and is versioned independently of the rest of nodecg-io like `nodecg-io-core` or the services.

The following table show which versions of the CLI are compatible with which nodecg-io versions:

| CLI versions | nodecg-io versions  |
| ------------ | ------------------- |
| `0.1`        | `0.1`               |
| `0.2-0.4`    | `0.2`, `0.1`        |
| `0.5`        | `0.3`, `0.2`, `0.1` |

## Developer workflow

Clone this repo, install the required dependencies and build it:

```console
$ git clone https://github.com/codeoverflow-org/nodecg-io-cli.git
$ cd nodecg-io-cli
$ npm i
$ npm run build
```

Then link your current local installation of the CLI to your global `node_modules` directory (might require `sudo` on linux):

```console
$ npm link
```

You can now use the `nodecg-io` command, and it will use your local install. You DO NOT need to rerun the link command after you make changes to the CLI, unless you move it another location. While developing you may want to start a TypeScript watcher by running `npm run watch` that will automatically update the JS files that are used while you make changes.
