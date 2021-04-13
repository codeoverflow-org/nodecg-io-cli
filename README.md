<!-- Do not include the top level heading when generating the
     table of contents using the vscode markdown all in one extension -->
<!-- prettier-ignore-start -->
<!-- omit in toc -->
# nodecg-io-cli
<!-- prettier-ignore-end -->

This is the cli for [nodecg-io](https://github.com/codeoverflow-org/nodecg-io) that allows you to easily manage your nodecg-io installation and helps you with nodecg-io related development.

## Table of contents

- [Table of contents](#table-of-contents)
- [Commands](#commands)
  - [`nodecg-io install`](#nodecg-io-install)
  - [`nodecg-io uninstall`](#nodecg-io-uninstall)
- [A note about versioning](#a-note-about-versioning)
- [Developer workflow](#developer-workflow)

---

## Commands

Here's a brief overview of the available commands. More indepth usage guides of these commands will be available in the [nodecg-io docs](https://nodecg.io) at some point.

### `nodecg-io install`

Installs nodecg-io to your current nodecg installation into a sub-directory called `nodecg-io`. Allows you to select which released version you want or if you wish to get a development install.

<!-- TODO: mention that it saves the state and allows for editing by rerunning. Mention updating -->

A production install fetches tarballs of the needed packages from the official npm registry, unpacks them, creates a `package.json` with all packages in a npm v7 workspace configuration and installs dependencies that way.

A development install clones the official git repository (`master`), installs dependencies, bootstraps all packages using lerna and builds all packages.

Either way at the end of the installation it will automatically add the nodecg-io directory (and samples if dev install and selected) to the `bundles.paths` array of your nodecg configuration. If you don't have a nodecg configuration it will create one for you.

If you later decide that you want to add or remove a service you can just re-run `nodecg-io install`. It saves your choices and makes them the default selected if you already have a installation so you can make changes to them. If you re-run the install command it will also pull the repo and rebuild if necessary in case of a development install and, in case of a production install, it will make any updates if some packages have a new patch version available. Updates of minor and major changes must be made explicitly by selecting the newer version when running the install command.

### `nodecg-io uninstall`

Undos everything that `nodecg-io install` did. It removes the `nodecg-io` directory with your installation and removes nodecg-io from your nodecg configuration.

## A note about versioning

This cli follows and is versioned independently from the rest of nodecg-io like `nodecg-io-core` or the services.

The following table show which versions of the cli are compatible with which nodecg-io versions:

| CLI versions | nodecg-io versions |
| ------------ | ------------------ |
| `0.1`        | `0.1`              |

Currently they are the same but we will follow [semver2](https://semver.org/) using [semantic-release](https://semantic-release.gitbook.io/semantic-release/) and the versions will diverge at some point.

## Developer workflow

Clone this repo, install the required dependencies and build it:

```console
$ git clone https://github.com/codeoverflow-org/nodecg-io-cli.git
$ cd nodecg-io-cli
$ npm i
$ npm run build
```

Then link your current local install of the cli to your global `node_modules` directory (might require `sudo` on linux):

```console
$ npm link
```

You can now use the `nodecg-io` command and it will use your local install. You DO NOT need to rerun the link command after you make changes to the cli, unless you move it another location. While developing you may want to start a TypeScript watcher by running `npm run watch` that will automatically update the JS files that are used while you make changes.
