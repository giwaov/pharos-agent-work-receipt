# Pharos Agent Work Receipt

**Pay an AI agent for completed work and record a public on-chain receipt on Pharos.**

Pharos Agent Work Receipt is a reusable Skill for the Pharos AI Agent economy. It gives agents a simple standard for paid work:

> An agent did work. Another agent paid in PROS. Pharos printed the receipt.

The project includes a Solidity receipt contract, a Node.js Skill CLI, agent behavior rules, and hackathon submission notes.

## Mainnet Deployment

AgentWorkReceipt is deployed on Pharos Mainnet.

| Field | Value |
|---|---|
| Network | Pharos Mainnet |
| Chain ID | `1672` (`0x688`) |
| Currency | `PROS` |
| RPC used | `https://infra.originstake.com/pharos/evm` |
| Contract | `0x0Aa0e39BF90d71530684EC2E80037639560646fD` |
| Deployer | `0x28abA2DFcf42eAdfEe60CeBFA650aC7184652424` |
| Deployment tx | `0x95b4a1be12d18d390ef28510b33110e363c959ba2b44435b57de763732f6bf04` |
| Deployment block | `9974379` |

Verification:

- Transaction receipt status: `0x1`
- `eth_getCode` confirms bytecode at the contract address
- CLI `doctor --contract` reports `"deployed": true`

## Why This Matters

AI agents will increasingly call other agents to complete specialized tasks: look up data, monitor wallets, generate reports, execute strategies, or run protocol-specific Skills. If those tasks are paid, the ecosystem needs a reliable record of what happened.

This Skill creates that record. A caller agent pays a provider agent in PROS, and the contract emits a receipt containing:

- caller address,
- provider address,
- Skill name,
- payment amount,
- input hash,
- output hash,
- optional metadata URI.

Those receipts can later be used by marketplace agents, reputation agents, billing agents, social graph agents, and analytics dashboards.

## Core Idea

```text
Caller Agent requests work
        |
        v
Provider Agent returns output
        |
        v
Caller pays provider in PROS
        |
        v
AgentWorkReceipt emits public receipt
        |
        v
Other agents index reputation, usage, and payment history
```

## What Is Included

| Component | Purpose |
|---|---|
| `contracts/AgentWorkReceipt.sol` | Pays the provider and emits the `AgentWorkPaid` receipt event |
| `pharos-agent-work-receipt.mjs` | CLI Skill for RPC checks, receipt planning, calldata preparation, and deployment |
| `SKILL.md` | Skill interface, commands, output contract, and safety notes |
| `AGENT.md` | Agent behavior rules for safe use |
| `SUBMISSION.md` | Hackathon-facing project summary |

## Contract Event

```solidity
event AgentWorkPaid(
    bytes32 indexed receiptId,
    address indexed caller,
    address indexed provider,
    string skill,
    uint256 amountWei,
    bytes32 inputHash,
    bytes32 outputHash,
    string metadataURI
);
```

The raw input and output do not need to be published on-chain. Agents can store the content elsewhere and put only SHA-256 hashes in the receipt.

## Quick Start

Install dependencies:

```bash
npm install
```

The CLI has zero runtime dependencies; `npm install` only prepares the lockfile-defined project environment.

Build the contract:

```bash
forge build
```

Configure Pharos mainnet:

```bash
# PowerShell
$env:PHAROS_RPC_URL="https://infra.originstake.com/pharos/evm"
$env:PHAROS_CHAIN_ID="1672"
$env:PHAROS_NETWORK_NAME="Pharos Mainnet"
```

Check Pharos mainnet RPC:

```bash
npm run doctor
```

Create a local receipt plan:

```bash
node pharos-agent-work-receipt.mjs receipt \
  --caller 0x0000000000000000000000000000000000000001 \
  --provider 0x0000000000000000000000000000000000000002 \
  --skill weather.lookup \
  --price 0.01 \
  --input '{"city":"Lagos"}' \
  --output '{"forecast":"sunny"}'
```

Prepare calldata for a payment transaction:

```bash
node pharos-agent-work-receipt.mjs prepare-pay \
  --contract 0xReceiptContract \
  --caller 0xCaller \
  --provider 0xProvider \
  --skill weather.lookup \
  --price 0.01 \
  --input '{"city":"Lagos"}' \
  --output '{"forecast":"sunny"}'
```

Deploy to Pharos mainnet:

```bash
forge build
PHAROS_DEPLOYER_PRIVATE_KEY=0x... node pharos-agent-work-receipt.mjs deploy --broadcast
```

Private keys are read from environment variables only. Do not pass private keys as command arguments.
The `--broadcast` flag is required and is forwarded to `forge create` so the transaction is actually submitted.

This repository intentionally has no default RPC. `doctor` and `deploy` require explicit Pharos mainnet environment variables so the project cannot accidentally deploy to the wrong network.

## Mainnet Verification

The provided Pharos mainnet RPC was checked with `doctor`:

```json
{
  "status": "success",
  "action": "doctor",
  "data": {
    "rpc": {
      "url": "https://infra.originstake.com/pharos/evm",
      "reachable": true
    },
    "network": {
      "name": "Pharos Mainnet",
      "expectedChainId": 1672,
      "actualChainId": 1672,
      "chainOk": true
    },
    "verdict": "ready"
  },
  "error": null
}
```

The deployed contract was also checked with `doctor --contract`:

```json
{
  "status": "success",
  "action": "doctor",
  "data": {
    "network": {
      "name": "Pharos Mainnet",
      "expectedChainId": 1672,
      "actualChainId": 1672,
      "chainOk": true
    },
    "contract": {
      "address": "0x0Aa0e39BF90d71530684EC2E80037639560646fD",
      "deployed": true,
      "byteLength": 1045
    },
    "verdict": "ready"
  },
  "error": null
}
```

## Example Output

```json
{
  "status": "success",
  "action": "receipt",
  "data": {
    "summary": "0x0000000000000000000000000000000000000001 pays 0x0000000000000000000000000000000000000002 0.01 PROS for weather.lookup",
    "receipt": {
      "skill": "weather.lookup",
      "priceWei": "10000000000000000",
      "pricePros": "0.01",
      "inputHash": "0x9640d5f576d3638fb98a6288ab68d064528037b8454c933b5061594263c9c1a4",
      "outputHash": "0x95436576a0daf9078b3b3acb1ae904f45d9a3e0cb149e5c2a90a500d85c9e325"
    }
  },
  "error": null
}
```

## Safety Model

- No private keys are accepted as CLI arguments.
- Deployment requires `PHAROS_DEPLOYER_PRIVATE_KEY` and explicit `--broadcast`.
- The contract rejects zero-address providers.
- The contract rejects zero-value payments.
- Inputs and outputs are stored as SHA-256 hashes, not raw private content.
- The CLI has a read-only `receipt` mode and a transaction-preparation `prepare-pay` mode.

## Phase 2 Path

This Phase 1 Skill can become a full Agent Arena project:

1. A user posts a task.
2. A provider agent completes the task.
3. The caller agent pays through `AgentWorkReceipt`.
4. A reputation agent indexes `AgentWorkPaid` events.
5. A marketplace agent routes future work to providers with the best paid-work history.
