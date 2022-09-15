const {EVM} = require('evm');
const express = require('express');
const cors = require('cors');

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
            const evm = new EVM(bytecode);
            const manifest = evmToManifest(evm);
            const artifact = evmToArtifact(evm);

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

function evmToManifest(evm) {
    return {
        name: "Imported Contract",
        description: "Imported smart contract.",
        tags: [],
        implements: [],
        eventDecorators: [],
        constructorDecorators: [],
        functionDecorators: evm.getFunctions().map(f => {
            const name = f.substring(0, f.indexOf("("));
            const parameterDecorators = f.substring(
                f.indexOf("(") + 1,
                f.indexOf(")")
            ).split(",").filter(v => !!v).map((t, index) => {
                const paramName = `param${index + 1}`;
                return {
                    name: paramName,
                    description: "",
                    recommended_types: [],
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
        })
    };
}

function evmToArtifact(evm) {
    return {
        contractName: "ImportedContract",
        sourceName: "ImportedContract.sol",
        bytecode: "",
        deployedBytecode: "",
        linkReferences: null,
        deployedLinkReferences: null,
        abi: evm.getFunctions().map(f => {
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
        })
    };
}
