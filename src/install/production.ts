import { ProductionInstallation } from "../installation";
import * as temp from "temp";
import { extractNpmPackageTar, fetchNpmPackage, installNpmDependencies, NpmPackage } from "../npmPackage";
import * as fs from "fs/promises";
import { SingleBar } from "cli-progress";

// Delete temporarily downloaded packages when exiting the CLI.
temp.track();

export async function createProductionInstall(info: ProductionInstallation, nodecgIODir: string): Promise<void> {
    // TODO: (maybe) detect changes in installation request and only remove/add changed packages instead of reinstalling everything
    await ensureNodecgIODirExists(nodecgIODir);

    const count = info.packages.length;
    console.log(`Installing ${count} packages (this might take a while)...`);

    const progressBar = new SingleBar({
        format: "Finished {value}/{total} packages [{bar}] {percentage}%",
    });

    try {
        progressBar.start(count, 0);

        // TODO: maybe show the packages that are still being installed
        // TODO: limit concurrency of npm install processes
        await Promise.all(
            info.packages.map(async (pkg) => {
                await processPackage(pkg, nodecgIODir);
                progressBar.increment();
            }),
        );
    } finally {
        // We must make sure to stop the progress bar because otherwise we'll write at the end of the line of the bar.
        progressBar.stop();
    }

    console.log(`Installed ${count} packages.`);
}

async function ensureNodecgIODirExists(nodecgIODir: string): Promise<void> {
    try {
        await fs.stat(nodecgIODir); // check whether directory exists
    } catch (_e) {
        await fs.mkdir(nodecgIODir);
    }
}

async function processPackage(pkg: NpmPackage, nodecgIODir: string): Promise<void> {
    const tarPath = await fetchPackage(pkg);
    await extractNpmPackageTar(pkg, tarPath, nodecgIODir);
    await installNpmDependencies(pkg, nodecgIODir);
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
