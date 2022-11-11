const express = require('express');
const cors = require('cors');
const { whatsabi } = require('@shazow/whatsabi');
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

const server = app.listen(PORT, function () {
    const host = server.address().address;
    const port = server.address().port;

    console.log("Example app listening at http://%s:%s", host, port);
});

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
    }).map(item => { return item.signatures[0]; });
    const functions = mapped.filter(item => {
        return (item.entry.type === 'function' && item.signatures.length > 0);
    }).map(item => { return item.signatures[0]; });
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
        const name = e.substring(0, e.indexOf("("));
        const parameterDecorators = e.substring(
            e.indexOf("(") + 1,
            e.indexOf(")")
        ).split(",").filter(v => !!v).map((t, index) => {
            const paramName = `param${index + 1}`;
            return {
                name: paramName,
                description: "",
                recommendedTypes: [],
                parameters: null
            }
        });
        return {
            signature: e,
            name: name,
            description: "",
            parameterDecorators: parameterDecorators
        }
    });
}

function createManifestFunctions(parsedBytecode) {
    return parsedBytecode.functions.map(f => {
        const name = f.substring(0, f.indexOf("("));
        const parameterDecorators = f.substring(
            f.indexOf("(") + 1,
            f.indexOf(")")
        ).split(",").filter(v => !!v).map((t, index) => {
            const paramName = `param${index + 1}`;
            return {
                name: paramName,
                description: "",
                recommendedTypes: [],
                parameters: null
            }
        });
        return {
            signature: f,
            name: name,
            description: "",
            parameterDecorators: parameterDecorators,
            returnDecorators: [],
            emittableEvents: []
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
        const name = e.substring(0, e.indexOf("("));
        const inputs = e.substring(
            e.indexOf("(") + 1,
            e.indexOf(")")
        ).split(",").filter(v => !!v).map((t, index) => {
            const paramName = `param${index + 1}`;
            return {
                components: null,
                internalType: t,
                name: paramName,
                type: t,
                indexed: null
            }
        });
        return {
            inputs: inputs,
            outputs: [],
            stateMutability: null,
            name: name,
            type: "event"
        }
    });
}

function createArtifactFunctions(parsedBytecode) {
    return parsedBytecode.functions.map(f => {
        const name = f.substring(0, f.indexOf("("));
        const inputs = f.substring(
            f.indexOf("(") + 1,
            f.indexOf(")")
        ).split(",").filter(v => !!v).map((t, index) => {
            const paramName = `param${index + 1}`;
            return {
                components: null,
                internalType: t,
                name: paramName,
                type: t,
                indexed: null
            }
        });
        return {
            inputs: inputs,
            outputs: [],
            stateMutability: null,
            name: name,
            type: "function"
        }
    });
}
