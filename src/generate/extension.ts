import CodeBlockWriter from "code-block-writer";
import { getServiceClientName } from "../nodecgIOVersions";
import { Installation } from "../utils/installation";
import { CodeLanguage, GenerationOptions } from "./prompt";
import { writeBundleFile } from "./utils";

interface ServiceNames {
    name: string;
    camelCase: string;
    pascalCase: string;
    clientName: string;
    packageName: string;
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

function getServiceNames(serviceBaseName: string, nodecgIOVersion: string): ServiceNames {
    return {
        name: serviceBaseName,
        camelCase: kebabCase2CamelCase(serviceBaseName),
        pascalCase: kebabCase2PascalCase(serviceBaseName),
        clientName: getServiceClientName(serviceBaseName, nodecgIOVersion),
        packageName: `nodecg-io-${serviceBaseName}`,
    };
}

export async function genExtension(opts: GenerationOptions, install: Installation): Promise<void> {
    // Generate all variants of the service names if were doing it from a production install.
    // We can't generate the imports and stuff if we currently have a development install because
    // the service names for each version are hardcoded and unknown for a development version.
    const services = install.dev === false ? opts.services.map((svc) => getServiceNames(svc, install.version)) : [];

    const writer = new CodeBlockWriter();

    // imports
    genImport(writer, "requireService", opts.corePackage.name, opts.language);

    if (opts.language === "typescript") {
        genImport(writer, "NodeCG", `${opts.nodeCGTypingsPackage}/types/server`, opts.language);
        // Service import statements
        services.forEach((svc) => {
            genImport(writer, svc.clientName, svc.packageName, opts.language);
        });
    }

    // global nodecg function
    writer.blankLine();
    const nodecgVariableType = opts.language === "typescript" ? ": NodeCG" : "";
    writer.write(`module.exports = function (nodecg${nodecgVariableType}) `).block(() => {
        genLog(writer, `${opts.bundleName} bundle started.`);
        writer.blankLine();

        // requireService calls
        services.forEach((svc) => genRequireServiceCall(writer, svc, opts.language));

        // onAvailable and onUnavailable calls
        services.forEach((svc) => {
            writer.blankLine();
            genOnAvailableCall(writer, svc);

            writer.blankLine();
            genOnUnavailableCall(writer, svc);
        });
    });

    const fileExtension = opts.language === "typescript" ? "ts" : "js";
    await writeBundleFile(writer.toString(), opts.bundlePath, "extension", `index.${fileExtension}`);
}

function genImport(writer: CodeBlockWriter, symbolToImport: string, packageName: string, lang: CodeLanguage) {
    if (lang === "typescript") {
        writer.write(`import { ${symbolToImport} } from `).quote(packageName).write(";");
    } else if (lang === "javascript") {
        writer.write(`const ${symbolToImport} = require(`).quote(packageName).write(`).${symbolToImport};`);
    } else {
        throw new Error("unsupported language: " + lang);
    }

    writer.write("\n");
}

function genLog(writer: CodeBlockWriter, logMessage: string) {
    writer.write("nodecg.log.info(").quote(logMessage).write(");");
}

function genRequireServiceCall(writer: CodeBlockWriter, svc: ServiceNames, lang: CodeLanguage) {
    writer.write(`const ${svc.camelCase} = requireService`);

    if (lang === "typescript") {
        // Add type parameter which is only needed in TypeScript
        writer.write(`<${svc.clientName}>`);
    }

    writer.write(`(nodecg, `).quote(svc.name).write(");\n");
}

function genOnAvailableCall(writer: CodeBlockWriter, svc: ServiceNames) {
    writer
        .write(`${svc.camelCase}?.onAvailable(async (${svc.camelCase}Client) => `)
        .inlineBlock(() => {
            genLog(writer, `${svc.name} service has been updated.`);
            writer.writeLine(`// You can now use the ${svc.name} client here.`);
        })
        .write(");");
}

function genOnUnavailableCall(writer: CodeBlockWriter, svc: ServiceNames) {
    writer
        .write(`${svc.camelCase}?.onUnavailable(() => `)
        .inlineBlock(() => {
            genLog(writer, `${svc.name} has been unset.`);
        })
        .write(");");
}
