#!/usr/bin/env node

import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RPC_URL = "https://atlantic.dplabs-internal.com";
const EXPECTED_CHAIN_ID = 688689n;
const NETWORK_NAME = "Pharos Atlantic Testnet";

const ABI = [
  "function receiptCount() view returns (uint256)",
  "function payForWork(address provider,string skill,bytes32 inputHash,bytes32 outputHash,string metadataURI) payable returns (bytes32)",
  "event AgentWorkPaid(bytes32 indexed receiptId,address indexed caller,address indexed provider,string skill,uint256 amountWei,bytes32 inputHash,bytes32 outputHash,string metadataURI)",
];

function emit(payload) {
  console.log(JSON.stringify(payload, (_key, value) => (
    typeof value === "bigint" ? value.toString() : value
  ), 2));
}

function ok(action, data) {
  emit({ status: "success", action, data, error: null });
}

function fail(action, code, message, next, data = {}) {
  emit({ status: "error", action, data, error: { code, message, next } });
}

function blocked(action, code, message, next, data = {}) {
  emit({ status: "blocked", action, data, error: { code, message, next } });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function provider() {
  return new ethers.JsonRpcProvider(process.env.PHAROS_RPC_URL || DEFAULT_RPC_URL);
}

function hashText(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(value || ""));
}

function requireAddress(value, name) {
  if (!ethers.isAddress(value || "")) {
    throw new Error(`${name} must be a valid EVM address.`);
  }
  return ethers.getAddress(value);
}

function requireSkill(value) {
  if (!value || value.length > 80) {
    throw new Error("--skill is required and must be 80 characters or fewer.");
  }
  return value;
}

function requirePrice(value) {
  if (!value || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) {
    throw new Error("--price must be a positive PROS amount, like 0.01.");
  }
  const parsed = ethers.parseEther(value);
  if (parsed <= 0n) throw new Error("--price must be greater than zero.");
  return parsed;
}

async function doctor(args) {
  const rpc = provider();
  try {
    const [network, blockNumber, feeData] = await Promise.all([
      rpc.getNetwork(),
      rpc.getBlockNumber(),
      rpc.getFeeData(),
    ]);

    let contract = null;
    if (args.contract) {
      const contractAddress = requireAddress(args.contract, "--contract");
      const code = await rpc.getCode(contractAddress);
      contract = {
        address: contractAddress,
        deployed: code !== "0x",
        byteLength: code === "0x" ? 0 : (code.length - 2) / 2,
      };
    }

    ok("doctor", {
      runtime: { node: process.version, ethers: ethers.version },
      rpc: { url: process.env.PHAROS_RPC_URL || DEFAULT_RPC_URL, reachable: true },
      network: {
        name: NETWORK_NAME,
        expectedChainId: Number(EXPECTED_CHAIN_ID),
        actualChainId: Number(network.chainId),
        chainOk: network.chainId === EXPECTED_CHAIN_ID,
        latestBlock: blockNumber,
      },
      feeData: {
        gasPriceWei: feeData.gasPrice?.toString() || null,
        maxFeePerGasWei: feeData.maxFeePerGas?.toString() || null,
      },
      contract,
      verdict: network.chainId === EXPECTED_CHAIN_ID ? "ready" : "wrong_chain",
    });
  } catch (error) {
    fail("doctor", "DOCTOR_ERROR", error.message, "Check RPC URL, network access, or contract address.");
  }
}

function buildReceipt(args) {
  const caller = requireAddress(args.caller, "--caller");
  const providerAddress = requireAddress(args.provider, "--provider");
  const skill = requireSkill(args.skill);
  const priceWei = requirePrice(args.price);
  const inputHash = args["input-hash"] || hashText(args.input || "");
  const outputHash = args["output-hash"] || hashText(args.output || "");
  const metadataURI = args["metadata-uri"] || "";

  if (!/^0x[0-9a-fA-F]{64}$/.test(inputHash)) {
    throw new Error("--input-hash must be bytes32.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(outputHash)) {
    throw new Error("--output-hash must be bytes32.");
  }

  return {
    caller,
    provider: providerAddress,
    skill,
    priceWei,
    pricePros: ethers.formatEther(priceWei),
    inputHash,
    outputHash,
    metadataURI,
  };
}

async function receipt(args) {
  try {
    const data = buildReceipt(args);
    ok("receipt", {
      summary: `${data.caller} pays ${data.provider} ${data.pricePros} PROS for ${data.skill}`,
      receipt: data,
      explanation: "This is the payment receipt plan. The contract will pay the provider and emit this work receipt on-chain.",
    });
  } catch (error) {
    fail("receipt", "RECEIPT_ERROR", error.message, "Check caller, provider, skill, price, input, and output arguments.");
  }
}

async function preparePay(args) {
  try {
    if (!args.contract) {
      fail("prepare-pay", "MISSING_CONTRACT", "--contract is required.", "Deploy AgentWorkReceipt or pass an existing contract address.");
      return;
    }

    const contract = requireAddress(args.contract, "--contract");
    const data = buildReceipt(args);
    const iface = new ethers.Interface(ABI);
    const calldata = iface.encodeFunctionData("payForWork", [
      data.provider,
      data.skill,
      data.inputHash,
      data.outputHash,
      data.metadataURI,
    ]);

    ok("prepare-pay", {
      to: contract,
      from: data.caller,
      valueWei: data.priceWei.toString(),
      valuePros: data.pricePros,
      calldata,
      receipt: data,
      explanation: "Send this transaction from caller to the receipt contract to pay the provider and create the receipt.",
    });
  } catch (error) {
    fail("prepare-pay", "PREPARE_ERROR", error.message, "Check contract, caller, provider, skill, price, input, and output arguments.");
  }
}

function loadBytecode() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifactPath = path.join(here, "out", "AgentWorkReceipt.sol", "AgentWorkReceipt.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Missing Foundry artifact. Run `forge build` first.");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.bytecode?.object || artifact.bytecode;
}

async function deploy(args) {
  try {
    const privateKey = process.env.PHAROS_DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      blocked("deploy", "MISSING_PRIVATE_KEY", "PHAROS_DEPLOYER_PRIVATE_KEY is not set.", "Set it locally in a secure shell to deploy.");
      return;
    }
    if (!args.broadcast) {
      blocked("deploy", "BROADCAST_REQUIRED", "Deployment requires --broadcast.", "Rerun with --broadcast after checking the deployer wallet.");
      return;
    }

    const rpc = provider();
    const network = await rpc.getNetwork();
    if (network.chainId !== EXPECTED_CHAIN_ID) {
      blocked("deploy", "WRONG_CHAIN", "RPC is not Pharos Atlantic Testnet.", "Set PHAROS_RPC_URL to the Pharos Atlantic RPC.");
      return;
    }

    const wallet = new ethers.Wallet(privateKey, rpc);
    const factory = new ethers.ContractFactory(ABI, loadBytecode(), wallet);
    const contract = await factory.deploy();
    const tx = contract.deploymentTransaction();
    await contract.waitForDeployment();

    ok("deploy", {
      deployer: wallet.address,
      contract: await contract.getAddress(),
      txHash: tx?.hash || null,
      chainId: Number(network.chainId),
    });
  } catch (error) {
    fail("deploy", "DEPLOY_ERROR", error.message, "Run forge build, fund deployer wallet, and retry.");
  }
}

function help() {
  ok("help", {
    pitch: "Pay an AI agent for completed work and print an on-chain receipt.",
    commands: [
      "doctor [--contract <address>]",
      "receipt --caller <address> --provider <address> --skill <name> --price <PROS> --input <json|string> --output <json|string>",
      "prepare-pay --contract <address> --caller <address> --provider <address> --skill <name> --price <PROS> --input <json|string> --output <json|string>",
      "deploy --broadcast",
    ],
  });
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (!command || command === "help" || command === "--help" || command === "-h") {
  help();
} else if (command === "doctor") {
  await doctor(args);
} else if (command === "receipt") {
  await receipt(args);
} else if (command === "prepare-pay") {
  await preparePay(args);
} else if (command === "deploy") {
  await deploy(args);
} else {
  fail("cli", "UNKNOWN_COMMAND", `Unknown command: ${command}`, "Use doctor, receipt, prepare-pay, deploy, or help.");
}
