import { ProductionInstallation } from "../installation";
import * as temp from "temp";
import { extractNpmPackageTar, fetchNpmPackage, installNpmDependencies, NpmPackage } from "../npmPackage";
import * as fs from "fs/promises";

// Delete temporarily downloaded packages when exiting the CLI.
temp.track();

export async function createProductionInstall(info: ProductionInstallation, nodecgIODir: string): Promise<void> {
    // TODO: (maybe) detect changes in installation request and only remove/add changed packages instead of reinstalling everything
    await ensureNodecgIODirExists(nodecgIODir);
    console.log(`Installing ${info.packages.length} packages...`);
    // TODO: add progress bar, this takes a while due to "npm install"
    await Promise.all(info.packages.map(processPackage));
    console.log(`Installed ${info.packages.length} packages.`);
}

async function ensureNodecgIODirExists(nodecgIODir: string): Promise<void> {
    try {
        await fs.stat(nodecgIODir); // check whether directory exists
    } catch (_e) {
        await fs.mkdir(nodecgIODir);
    }
}

async function processPackage(pkg: NpmPackage): Promise<void> {
    const tarPath = await fetchPackage(pkg);
    await extractNpmPackageTar(pkg, tarPath);
    await installNpmDependencies(pkg);
}

async function fetchPackage(pkg: NpmPackage): Promise<string> {
    // Stream from axios to gunzip/untar directly to get rid of these temp files
    const file = await createTempPackageFile(pkg);
    await fetchNpmPackage(pkg, file.path);
    return file.path;
}

async function createTempPackageFile(pkg: NpmPackage): Promise<temp.OpenFile> {
    return new Promise((resolve, reject) => {
        temp.open(`nodecg-io-cli-pkg-${pkg.name}-${pkg.version}`, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
}
