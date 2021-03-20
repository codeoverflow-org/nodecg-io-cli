import { ProductionInstallation } from "../installation";
import * as temp from "temp";
import { fetchNpmPackage, NpmPackage } from "../npmPackage";

// Delete temporarily downloaded packages when exiting the CLI.
temp.track();

export async function createProductionInstall(info: ProductionInstallation, nodecgIODir: string): Promise<void> {
    const tarPaths = await Promise.all(info.packages.map(fetchPackage));
}

async function fetchPackage(pkg: NpmPackage): Promise<string> {
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
