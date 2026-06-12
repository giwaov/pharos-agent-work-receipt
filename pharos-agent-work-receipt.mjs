#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const NETWORK_NAME = process.env.PHAROS_NETWORK_NAME || "Pharos Mainnet";
const PAY_FOR_WORK_SELECTOR = "efcbc809";

function rpcUrl() {
  if (!process.env.PHAROS_RPC_URL) {
    throw new Error("PHAROS_RPC_URL is required for mainnet mode.");
  }
  return process.env.PHAROS_RPC_URL;
}

function expectedChainId() {
  if (!process.env.PHAROS_CHAIN_ID) {
    throw new Error("PHAROS_CHAIN_ID is required for mainnet mode.");
  }
  return BigInt(process.env.PHAROS_CHAIN_ID);
}

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

async function rpcCall(method, params = []) {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}: ${response.statusText}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`${body.error.code}: ${body.error.message}`);
  }
  return body.result;
}

function hashText(value) {
  return `0x${crypto.createHash("sha256").update(value || "", "utf8").digest("hex")}`;
}

function requireAddress(value, name) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value || "")) {
    throw new Error(`${name} must be a valid EVM address.`);
  }
  return value;
}

function requireSkill(value) {
  if (!value || value.length > 80) {
    throw new Error("--skill is required and must be 80 characters or fewer.");
  }
  return value;
}

function parseProsToWei(value) {
  if (!value || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)) {
    throw new Error("--price must be a positive PROS amount, like 0.01.");
  }

  const [whole, fractional = ""] = value.split(".");
  const wei = BigInt(whole) * 10n ** 18n + BigInt((fractional + "0".repeat(18)).slice(0, 18));
  if (wei <= 0n) {
    throw new Error("--price must be greater than zero.");
  }
  return wei;
}

function formatWeiAsPros(wei) {
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function requireBytes32(value, name) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value || "")) {
    throw new Error(`${name} must be bytes32.`);
  }
  return value.toLowerCase();
}

function word(hexWithoutPrefix) {
  return hexWithoutPrefix.padStart(64, "0");
}

function encodeUint(value) {
  return word(value.toString(16));
}

function encodeAddress(address) {
  return word(address.slice(2).toLowerCase());
}

function encodeBytes32(value) {
  return value.slice(2).toLowerCase();
}

function encodeString(value) {
  const hex = Buffer.from(value, "utf8").toString("hex");
  const byteLength = BigInt(hex.length / 2);
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return encodeUint(byteLength) + hex.padEnd(paddedLength, "0");
}

function encodePayForWork(provider, skill, inputHash, outputHash, metadataURI) {
  const encodedSkill = encodeString(skill);
  const encodedMetadata = encodeString(metadataURI);
  const skillOffset = 5n * 32n;
  const metadataOffset = skillOffset + BigInt(encodedSkill.length / 2);

  const head = [
    encodeAddress(provider),
    encodeUint(skillOffset),
    encodeBytes32(inputHash),
    encodeBytes32(outputHash),
    encodeUint(metadataOffset),
  ].join("");

  return `0x${PAY_FOR_WORK_SELECTOR}${head}${encodedSkill}${encodedMetadata}`;
}

function buildReceipt(args) {
  const caller = requireAddress(args.caller, "--caller");
  const provider = requireAddress(args.provider, "--provider");
  const skill = requireSkill(args.skill);
  const priceWei = parseProsToWei(args.price);
  const inputHash = args["input-hash"] ? requireBytes32(args["input-hash"], "--input-hash") : hashText(args.input || "");
  const outputHash = args["output-hash"] ? requireBytes32(args["output-hash"], "--output-hash") : hashText(args.output || "");
  const metadataURI = args["metadata-uri"] || "";

  return {
    caller,
    provider,
    skill,
    priceWei,
    pricePros: formatWeiAsPros(priceWei),
    inputHash,
    outputHash,
    metadataURI,
  };
}

async function doctor(args) {
  try {
    const expected = expectedChainId();
    const [chainIdHex, blockNumberHex, gasPriceHex] = await Promise.all([
      rpcCall("eth_chainId"),
      rpcCall("eth_blockNumber"),
      rpcCall("eth_gasPrice"),
    ]);

    const actualChainId = BigInt(chainIdHex);
    let contract = null;
    if (args.contract) {
      const contractAddress = requireAddress(args.contract, "--contract");
      const code = await rpcCall("eth_getCode", [contractAddress, "latest"]);
      contract = {
        address: contractAddress,
        deployed: code !== "0x",
        byteLength: code === "0x" ? 0 : (code.length - 2) / 2,
      };
    }

    ok("doctor", {
      runtime: {
        node: process.version,
        dependencies: "none",
      },
      rpc: {
        url: rpcUrl(),
        reachable: true,
      },
      network: {
        name: NETWORK_NAME,
        expectedChainId: Number(expected),
        actualChainId: Number(actualChainId),
        chainOk: actualChainId === expected,
        latestBlock: Number(BigInt(blockNumberHex)),
      },
      feeData: {
        gasPriceWei: BigInt(gasPriceHex).toString(),
      },
      contract,
      verdict: actualChainId === expected ? "ready" : "wrong_chain",
    });
  } catch (error) {
    fail("doctor", "DOCTOR_ERROR", error.message, "Set PHAROS_RPC_URL and PHAROS_CHAIN_ID to the official Pharos mainnet values.");
  }
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
    const calldata = encodePayForWork(
      data.provider,
      data.skill,
      data.inputHash,
      data.outputHash,
      data.metadataURI,
    );

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

function ensureArtifactExists() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const artifactPath = path.join(here, "out", "AgentWorkReceipt.sol", "AgentWorkReceipt.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Missing Foundry artifact. Run `forge build` first.");
  }
}

async function deploy(args) {
  try {
    const expected = expectedChainId();
    const privateKey = process.env.PHAROS_DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      blocked("deploy", "MISSING_PRIVATE_KEY", "PHAROS_DEPLOYER_PRIVATE_KEY is not set.", "Set it locally in a secure shell to deploy.");
      return;
    }
    if (!args.broadcast) {
      blocked("deploy", "BROADCAST_REQUIRED", "Deployment requires --broadcast.", "Rerun with --broadcast after checking the deployer wallet.");
      return;
    }

    const chainIdHex = await rpcCall("eth_chainId");
    if (BigInt(chainIdHex) !== expected) {
      blocked("deploy", "WRONG_CHAIN", "RPC is not the configured Pharos mainnet chain.", "Check PHAROS_RPC_URL and PHAROS_CHAIN_ID before deploying.");
      return;
    }

    ensureArtifactExists();

    const result = spawnSync("forge", [
      "create",
      "contracts/AgentWorkReceipt.sol:AgentWorkReceipt",
      "--broadcast",
      "--rpc-url",
      rpcUrl(),
      "--private-key",
      privateKey,
    ], {
      encoding: "utf8",
      windowsHide: true,
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "forge create failed");
    }

    ok("deploy", {
      network: NETWORK_NAME,
      output: result.stdout.trim(),
      note: "Inspect forge output for deployed contract address and transaction hash.",
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
    environment: {
      PHAROS_RPC_URL: "Required. Official Pharos mainnet JSON-RPC endpoint.",
      PHAROS_CHAIN_ID: "Required. Official Pharos mainnet chain ID.",
      PHAROS_NETWORK_NAME: "Optional. Defaults to Pharos Mainnet.",
      PHAROS_DEPLOYER_PRIVATE_KEY: "Required only for deploy --broadcast.",
    },
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
