import CodeBlockWriter from "code-block-writer";
import { getServiceClientName } from "../nodecgIOVersions";
import { ProductionInstallation } from "../utils/installation";
import { GenerationOptions } from "./prompt";
import { write } from "./index";

export async function generateExtension(
    bundlePath: string,
    opts: GenerationOptions,
    install: ProductionInstallation,
): Promise<void> {
    // Shouldn't happen...
    if (!opts.corePackage) throw new Error("corePackage is undefined");

    // Generate further information for each service which is needed to generate the bundle extension.
    const services = opts.services.map((svc) => ({
        name: svc,
        camelCase: kebabCase2CamelCase(svc),
        pascalCase: kebabCase2PascalCase(svc),
        clientName: getServiceClientName(svc, install.version),
        packageName: `nodecg-io-${svc}`,
    }));

    const writer = new CodeBlockWriter();

    genImport(writer, "NodeCG", "nodecg/types/server");
    genImport(writer, "requireService", opts.corePackage.name);

    // Service import statements
    services.forEach((svc) => {
        genImport(writer, svc.clientName, svc.packageName);
    });

    // global nodecg function
    writer.blankLine();
    writer.write("module.exports = function (nodecg: NodeCG) ").block(() => {
        genLog(writer, `${opts.bundleName} bundle started.`);
        writer.blankLine();

        // requireService calls
        services.forEach((svc) => {
            writer
                .write(`const ${svc.camelCase} = requireService<${svc.clientName}>(nodecg, `)
                .quote(svc.name)
                .writeLine(");");
        });

        // onAvailable and onUnavailable calls
        services.forEach((svc) => {
            writer.blankLine();

            writer
                .write(`${svc.camelCase}?.onAvailable(async (${svc.camelCase}Client) => `)
                .inlineBlock(() => {
                    genLog(writer, `${svc.name} service has been updated.`);
                    writer.writeLine(`// You can now use the ${svc.name} client here.`);
                })
                .write(");");

            writer.blankLine();
            writer
                .write(`${svc.camelCase}?.onUnavailable(() => `)
                .inlineBlock(() => {
                    genLog(writer, `${svc.name} has been unset.`);
                })
                .write(");");
        });
    });

    write(writer.toString(), bundlePath, "extension", "index.ts");
}

function kebabCase2CamelCase(str: string): string {
    const parts = str.split("-");
    const capitalizedParts = parts.map((p, idx) => (idx === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)));
    return capitalizedParts.join("");
}

function kebabCase2PascalCase(str: string): string {
    const camelCase = kebabCase2CamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

function genImport(writer: CodeBlockWriter, symbolToImport: string, packageName: string) {
    writer.write(`import { ${symbolToImport} } from `).quote(packageName).write(";");
}

function genLog(writer: CodeBlockWriter, logMessage: string) {
    writer.write("nodecg.log.info(").quote(logMessage).write(");");
}
