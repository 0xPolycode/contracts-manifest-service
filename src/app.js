const { EVM } = require('evm');
const Web3 = require('web3');
const express = require('express');
const cors = require('cors');

const providers = {
    "1": new Web3("https://rpc.ankr.com/eth"),
    "5": new Web3("http://goerli.prylabs.net"),
    "137": new Web3("https://polygon-rpc.com"),
    "80001": new Web3("https://rpc-mumbai.maticvigil.com")
};

const PORT = valueOrDefault(process.env.PORT, 42070);

var app = express();
app.use(cors({
    origin: '*'
}));
app.get('/:chainId/:contractAddress', async (req,res) => {
    try {
        const chainId = req.params.chainId;
        const contractAddress = req.params.contractAddress;
        const bytecode = await fetchBytecode(contractAddress, chainId);
        if (!bytecode || bytecode === "0x") {
            res.status(400).json({
                error: `Empty code on given address!`
            });   
        } else {
            const evm = new EVM(bytecode);
            const manifest = evmToManifest(evm);
            res.json(manifest);
        }
    } catch (err) {
        res.status(400).json({
            error: `${err}`
        });
    }
});
var server = app.listen(PORT, function () {
    var host = server.address().address;
    var port = server.address().port;
    
    console.log("Example app listening at http://%s:%s", host, port);
 })

function evmToManifest(evm) {
    return {
        id: "imported",
        name: "Imported Contract",
        description: "Imported smart contract.",
        binary: "",
        tags: [],
        implements: [],
        constructors: [],
        functions: evm.getFunctions().map(f => {
            const name = f.substring(0, f.indexOf("("));
            const inputs = f.substring(
                f.indexOf("(") + 1,
                f.indexOf(")")
            ).split(",").filter(v => !!v).map((t, index) => {
                const paramName = `param${index+1}`;
                return {
                    name: paramName,
                    description: "",
                    solidity_name: paramName,
                    solidity_type: t,
                    recommended_types: [],
                    parameters: null
                }
            });
            return {
                name: name,
                description: "",
                solidity_name: name,
                inputs: inputs,
                outputs: [],
                emittable_events: [],
                read_only: false
            }
        }),
        events: []
    };
}

async function fetchBytecode(contractAddress, chainId) {
    return provider(chainId).eth.getCode(contractAddress);
}

function provider(chainId) {
    if (!!providers[`${chainId}`]) { 
        return providers[chainId]
    } else {
        throw "Unsupported blockchain network!"
    }
}

function valueOrDefault(value, defaultValue) {
    return (value !== undefined) ? value : defaultValue
}
