const express = require('express');
const cors = require('cors');
const {whatsabi} = require('@shazow/whatsabi');
const signatureLookup = new whatsabi.loaders.SamczunSignatureLookup();

const PORT = process.env.PORT || 42070;
const app = express();

app.use(cors({origin: '*'}));
app.use(express.json());

app.post('/decompile-contract', async (req, res) => {
    try {
        const bytecode = req.body.bytecode;
        if (!bytecode || bytecode === "0x") {
            res.status(400).json({
                error: `Empty contract bytecode provided!`
            });
        } else {
            const parsedBytecode = await parseBytecode(bytecode);
            const manifest = abiToManifest(parsedBytecode);
            const artifact = abiToArtifact(parsedBytecode);
            res.json({
                manifest: manifest,
                artifact: artifact
            });
        }
    } catch (err) {
        res.status(400).json({
            error: `${err}`
        });
    }
});

app.get('/function-signature/:signature', async (req, res) => {
    try {
        const signature = req.params.signature;

        if (!signature || signature.length !== 10) {
            res.status(400).json({
                error: `Invalid function signature provided!`
            });
        } else {
            const resolvedSignatures = await signatureLookup.loadFunctions(signature);

            if (resolvedSignatures.length >= 1) {
                const abiLikeFunction = {
                    functions: [resolvedSignatures[0]]
                };
                const artifact = createArtifactFunctions(abiLikeFunction);

                res.json({
                    name: artifact[0].name,
                    inputs: artifact[0].inputs
                });
            } else {
                res.status(404).json({
                    error: `Signature not found.`
                });
            }
        }
    } catch (err) {
        res.status(400).json({
            error: `${err}`
        });
    }
});

const server = app.listen(PORT, function () {
    const host = server.address().address;
    const port = server.address().port;

    console.log("Example app listening at http://%s:%s", host, port);
});

// TODO add typescript source dependency
function mapToParamDecorator(paramType, index) {
    const name = `param${index + 1}`;
    if (typeof (paramType) === "string") {
        return {
            name: name,
            description: "",
            recommendedTypes: [],
            parameters: null
        };
    } else {
        return {
            name: name,
            description: "",
            recommendedTypes: [],
            parameters: paramType.items.map(mapToParamDecorator)
        };
    }
}

function mapToArtifactObject(paramType, index) {
    const name = `param${index + 1}`;
    if (typeof (paramType) === "string") {
        return {
            name: name,
            type: paramType,
            internalType: paramType,
            components: null,
            indexed: null
        };
    } else {
        return {
            name: name,
            type: "tuple" + paramType.array,
            internalType: "tuple" + paramType.array,
            components: paramType.items.map(mapToArtifactObject),
            indexed: null
        };
    }
}

function extractArray(string) {
    for (let index = 0; index < string.length; index++) {
        const char = string[index];
        if (char !== '[' && char !== ']') {
            return string.substring(0, index);
        }
    }
    return "";
}

function parseParams(paramsString) {
    const res = {items: [], array: ""};
    let startIndex = 0;
    let index = 0;
    for (; index < paramsString.length; index++) {
        const char = paramsString[index];
        if (char === '(') {
            res.items.push(paramsString.substring(startIndex, index));
            const innerRes = parseParams(paramsString.substring(index + 1));
            index += innerRes.len + 1;
            startIndex = index + 1;
            res.items.push(innerRes.res);
        } else if (char === ')') {
            res.items.push(paramsString.substring(startIndex, index));
            res.array = extractArray(paramsString.substring(index + 1));
            return {res, len: index + res.array.length};
        }
    }
    res.items.push(paramsString.substring(startIndex));
    return {res, len: index};
}

function cleanParamArray(p) {
    if (typeof (p) === "string") {
        return p.split(",").filter(v => !!v);
    } else {
        const items = p.items.flatMap(cleanParamArray);
        return [{
            items: p.items.flatMap(cleanParamArray),
            array: p.array,
            length: items.length
        }];
    }
}

function mapParams(paramsString, isDecorator) {
    const parseRes = parseParams(paramsString).res;
    const cleanParams = parseRes.items.flatMap(cleanParamArray).filter(v => v.length > 0);
    if (isDecorator) {
        return cleanParams.map(mapToParamDecorator);
    } else {
        return cleanParams.map(mapToArtifactObject);
    }
}

function parseTypeSignature(signature, isDecorator) {
    const startIndex = signature.indexOf("(");
    const endIndex = signature.lastIndexOf(")");
    const name = signature.substring(0, startIndex);
    const paramsString = signature.substring(startIndex + 1, endIndex);
    const items = mapParams(paramsString, isDecorator);
    return {
        name,
        items
    };
}

// end TODO add typescript source dependency

async function parseBytecode(bytecode) {
    const abi = whatsabi.abiFromBytecode(bytecode);
    const mapped = await Promise.all(abi.map(async (entry) => {
        if (entry.type === 'event') {
            const sig = await signatureLookup.loadEvents(entry.hash);
            return {
                signatures: sig,
                entry
            }
        } else if (entry.type === 'function') {
            const sig = await signatureLookup.loadFunctions(entry.selector);
            return {
                signatures: sig,
                entry
            }
        } else {
            return {
                signatures: [],
                entry
            }
        }
    }));
    const events = mapped.filter(item => {
        return (item.entry.type === 'event' && item.signatures.length > 0);
    }).map(item => {
        return item.signatures[0];
    });
    const functions = mapped.filter(item => {
        return (item.entry.type === 'function' && item.signatures.length > 0);
    }).map(item => {
        return item.signatures[0];
    });
    return {
        events,
        functions
    };
}

function abiToManifest(parsedBytecode) {
    return {
        name: "Imported Contract",
        description: "Imported smart contract.",
        tags: [],
        implements: [],
        eventDecorators: createManifestEvents(parsedBytecode),
        constructorDecorators: [],
        functionDecorators: createManifestFunctions(parsedBytecode)
    };
}

function createManifestEvents(parsedBytecode) {
    return parsedBytecode.events.map(e => {
        const parsedSignature = parseTypeSignature(e, true);
        const signatureTypes = e.substring(e.indexOf("(")).replaceAll("(", "tuple(");

        return {
            signature: `${parsedSignature.name}${signatureTypes}`,
            name: parsedSignature.name,
            description: "",
            parameterDecorators: parsedSignature.items
        }
    });
}

function createManifestFunctions(parsedBytecode) {
    return parsedBytecode.functions.map(f => {
        const parsedSignature = parseTypeSignature(f, true);
        const signatureTypes = f.substring(f.indexOf("(")).replaceAll("(", "tuple(");

        return {
            signature: `${parsedSignature.name}${signatureTypes}`,
            name: parsedSignature.name,
            description: "",
            parameterDecorators: parsedSignature.items,
            returnDecorators: [],
            emittableEvents: [],
            readOnly: false
        }
    });
}

function abiToArtifact(parsedBytecode) {
    return {
        contractName: "ImportedContract",
        sourceName: "ImportedContract.sol",
        bytecode: "",
        deployedBytecode: "",
        linkReferences: null,
        deployedLinkReferences: null,
        abi: createArtifactFunctions(parsedBytecode).concat(createArtifactEvents(parsedBytecode))
    };
}

function createArtifactEvents(parsedBytecode) {
    return parsedBytecode.events.map(e => {
        const parsedSignature = parseTypeSignature(e, false);
        return {
            inputs: parsedSignature.items,
            outputs: [],
            stateMutability: null,
            name: parsedSignature.name,
            type: "event"
        }
    });
}

function createArtifactFunctions(parsedBytecode) {
    return parsedBytecode.functions.map(f => {
        const parsedSignature = parseTypeSignature(f, false);
        return {
            inputs: parsedSignature.items,
            outputs: [],
            stateMutability: null,
            name: parsedSignature.name,
            type: "function"
        }
    });
}
