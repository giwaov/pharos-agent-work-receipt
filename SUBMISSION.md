# Hackathon Submission

## Project Name

Pharos Agent Work Receipt

## One-Line Description

Pay an AI agent for completed work and print an on-chain receipt on Pharos.

## The 30-Second Pitch

AI agents will call each other to get work done. One agent might ask another agent to check a price, write a report, monitor a wallet, or execute a Skill.

But after the work is done, how do we prove who did it and who got paid?

**Pharos Agent Work Receipt** solves that. It lets one agent pay another agent on Pharos and creates a public receipt for the completed Skill.

Simple version:

> An agent did work. Another agent paid. Pharos printed the receipt.

## Why This Is Useful

Agent economies need more than tools. They need proof of work, payment history, and reputation.

This Skill creates the basic record that other agents can build on:

- marketplace agents can rank providers,
- reputation agents can count completed paid work,
- billing agents can reconcile payments,
- social agents can map agent-to-agent collaboration,
- users can see what their agent paid for.

## What It Builds

1. A simple Solidity contract on Pharos.
2. A CLI Skill that creates receipt plans.
3. A transaction-preparation command for payment.
4. A standard receipt event for other agents to index.

## Contract Behavior

The caller sends PROS to the contract with:

- provider address,
- Skill name,
- SHA-256 input hash,
- SHA-256 output hash,
- optional metadata URI.

The contract sends PROS to the provider and emits:

```text
AgentWorkPaid(receiptId, caller, provider, skill, amountWei, inputHash, outputHash, metadataURI)
```

## Commands

Install:

```bash
npm install
```

Build:

```bash
forge build
```

Check Pharos:

```bash
PHAROS_RPC_URL=https://infra.originstake.com/pharos/evm \
PHAROS_CHAIN_ID=1672 \
node pharos-agent-work-receipt.mjs doctor
```

Create a receipt plan:

```bash
node pharos-agent-work-receipt.mjs receipt \
  --caller 0x0000000000000000000000000000000000000001 \
  --provider 0x0000000000000000000000000000000000000002 \
  --skill weather.lookup \
  --price 0.01 \
  --input '{"city":"Lagos"}' \
  --output '{"forecast":"sunny"}'
```

Prepare payment calldata:

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

Deploy:

```bash
PHAROS_RPC_URL=https://infra.originstake.com/pharos/evm \
PHAROS_CHAIN_ID=1672 \
PHAROS_DEPLOYER_PRIVATE_KEY=0x... \
node pharos-agent-work-receipt.mjs deploy --broadcast
```

## Why It Fits Pharos

Pharos is built for on-chain payments, social interactions, and intelligent agents. This Skill touches all three:

- it makes a payment,
- it links two agent addresses,
- it records the Skill that was completed.

## Why It Can Become A Phase 2 Agent

Phase 2 can turn this into a full **Agent Job Board**:

1. Users post tasks.
2. Provider agents complete tasks.
3. This Skill pays providers and records receipts.
4. A reputation agent ranks providers by paid completed work.
5. A marketplace agent routes future jobs to the best providers.

## Judging Fit

| Criterion | Fit |
|---|---|
| Originality | Creates a simple receipt layer for paid AI-agent work. |
| Technical quality | Solidity contract, Pharos RPC checks, transaction calldata generation. |
| Practical use | Any paid Skill can use it. |
| Reusability | Skill name, SHA-256 input hash, SHA-256 output hash, and metadata work for many agent tasks. |
| Pharos integration | Native PROS payment and receipt event. |
| Documentation | Simple explanation, commands, and agent behavior rules. |

## Verification Output

Local contract build:

```text
Compiler run successful
```

Receipt plan output:

```json
{
  "status": "success",
  "action": "receipt",
  "data": {
    "summary": "0x0000000000000000000000000000000000000001 pays 0x0000000000000000000000000000000000000002 0.01 PROS for weather.lookup",
    "explanation": "This is the payment receipt plan. The contract will pay the provider and emit this work receipt on-chain."
  },
  "error": null
}
```

Pharos mainnet RPC check:

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

## Repository Structure

| File | Purpose |
|---|---|
| `contracts/AgentWorkReceipt.sol` | Solidity payment and receipt contract |
| `pharos-agent-work-receipt.mjs` | Skill CLI |
| `README.md` | Judge-facing overview and demo flow |
| `SKILL.md` | Skill interface and output contract |
| `AGENT.md` | Agent behavior and guardrails |
