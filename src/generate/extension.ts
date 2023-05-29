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
    genImport(writer, "requireService", opts.corePackage.name, opts.language, false);

    if (opts.language === "typescript") {
        generateNodeCGImport(writer, opts, install);

        // Service import statements
        services.forEach((svc) => {
            genImport(writer, svc.clientName, svc.packageName, opts.language, false);
        });
    }

    // global nodecg function
    writer.blankLine();
    writer.write(`module.exports = function (nodecg${getNodeCGType(opts, install)}) `).block(() => {
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

function genImport(
    writer: CodeBlockWriter,
    symbolToImport: string,
    packageName: string,
    lang: CodeLanguage,
    isDefaultImport: boolean,
) {
    if (lang === "typescript") {
        writer.write("import ");

        if (!isDefaultImport) {
            writer.write("{ ");
        }
        writer.write(symbolToImport);
        if (!isDefaultImport) {
            writer.write(" }");
        }

        writer.write(` from `).quote(packageName).write(";");
    } else if (lang === "javascript") {
        writer.write(`const ${symbolToImport} = require(`).quote(packageName).write(")");

        if (!isDefaultImport) {
            writer.write(`.${symbolToImport}`);
        }

        writer.write(";");
    } else {
        throw new Error("unsupported language: " + lang);
    }

    writer.write("\n");
}

export function determineNodeCGImportPath(opts: GenerationOptions, install: Installation): string {
    if (install.version === "0.1") {
        // nodecg-io 0.1 is only compatible with the NodeCG typings bundled inside the full nodecg package
        return "nodecg/types/server";
    } else if (install.version === "0.2" || opts.nodeCGVersion.major === 1) {
        // nodecg-io 0.2 is only compatible with nodecg-types.
        // Newer versions are compatible with both: nodecg-types (NodeCG v1) and @nodecg/types (NodeCG v2)
        // There we check the current nodecg version to determine which import to use.
        return "nodecg-types/types/server";
    } else if (opts.nodeCGVersion.major === 2) {
        // All versions from 0.3 and upwards support the official @nodecg/types package for NodeCG v2
        return "@nodecg/types";
    } else {
        throw new Error(
            "unable to determine nodecg typings import for nodecg " +
                opts.nodeCGVersion +
                " and nodecg-io " +
                install.version,
        );
    }
}

function generateNodeCGImport(writer: CodeBlockWriter, opts: GenerationOptions, install: Installation) {
    const importPath = determineNodeCGImportPath(opts, install);
    const isDefaultImport = opts.nodeCGVersion.major === 2 && install.version !== "0.1" && install.version !== "0.2";
    genImport(writer, "NodeCG", importPath, opts.language, isDefaultImport);
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

function getNodeCGType(opts: GenerationOptions, install: Installation): string {
    if (opts.language !== "typescript") {
        return "";
    }

    if (install.version === "0.1" || install.version === "0.2" || opts.nodeCGVersion.major === 1) {
        return ": NodeCG";
    } else {
        return ": NodeCG.ServerAPI";
    }
}
