---
name: pharos-agent-work-receipt
description: "A simple Pharos Skill that pays an AI agent for completed work and creates an on-chain receipt."
metadata:
  author: "giwaov"
  author-agent: "CrabDAO Reaper"
  user-invocable: "true"
  arguments: "doctor | receipt | prepare-pay | deploy"
  entry: "pharos-agent-work-receipt/pharos-agent-work-receipt.mjs"
  requires: "node, foundry, pharos-rpc"
  tags: "pharos, ai-agent, payments, receipts, infrastructure, write"
---

# Pharos Agent Work Receipt

## The Simple Explanation

This Skill is a **payment receipt printer for AI agents**.

When one agent does useful work for another agent, the caller can pay the provider on Pharos. The smart contract sends the payment and prints a public receipt that says:

- who paid,
- who got paid,
- what Skill was used,
- how much was paid,
- what input was requested,
- what output was delivered.

The input and output are stored as SHA-256 hashes, so private details do not need to be put on-chain.

## Why Agents Need It

Pharos wants an economy of AI agents. Economies need receipts.

Without receipts:

- agents cannot prove who did useful work,
- providers cannot build reputation,
- marketplaces cannot rank agents,
- payment history is hard to verify,
- Skill usage stays invisible.

This Skill gives every paid agent task a simple on-chain proof.

## What It Does

1. Creates a payment receipt plan.
2. Hashes the Skill input and output.
3. Prepares a transaction that pays the provider.
4. Emits an on-chain receipt when payment is made.

## Commands

### doctor

Checks Pharos RPC and chain ID.

```bash
PHAROS_RPC_URL=https://infra.originstake.com/pharos/evm \
PHAROS_CHAIN_ID=1672 \
node pharos-agent-work-receipt.mjs doctor
```

### receipt

Creates a receipt plan without sending a transaction.

```bash
node pharos-agent-work-receipt.mjs receipt \
  --caller 0x0000000000000000000000000000000000000001 \
  --provider 0x0000000000000000000000000000000000000002 \
  --skill weather.lookup \
  --price 0.01 \
  --input '{"city":"Lagos"}' \
  --output '{"forecast":"sunny"}'
```

### prepare-pay

Creates calldata for the payment transaction.

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

### deploy

Deploys the contract only with an explicit deployer key and `--broadcast`.

```bash
forge build
PHAROS_RPC_URL=https://infra.originstake.com/pharos/evm \
PHAROS_CHAIN_ID=1672 \
PHAROS_DEPLOYER_PRIVATE_KEY=0x... \
node pharos-agent-work-receipt.mjs deploy --broadcast
```

## Output Contract

Success:

```json
{
  "status": "success",
  "action": "receipt",
  "data": {
    "summary": "caller pays provider 0.01 PROS for weather.lookup",
    "receipt": {
      "caller": "0x...",
      "provider": "0x...",
      "skill": "weather.lookup",
      "pricePros": "0.01",
      "inputHash": "0x...",
      "outputHash": "0x..."
    },
    "explanation": "This is the payment receipt plan."
  },
  "error": null
}
```

Blocked:

```json
{
  "status": "blocked",
  "action": "deploy",
  "data": {},
  "error": {
    "code": "BROADCAST_REQUIRED",
    "message": "Deployment requires --broadcast.",
    "next": "Rerun with --broadcast after checking the deployer wallet."
  }
}
```

## Safety Notes

- The Skill never accepts private keys as command-line arguments.
- Deployment requires a local environment variable.
- The receipt contract only stores SHA-256 hashes of input and output.
- The provider must be a valid address.
- The payment amount must be greater than zero.

## Phase 2 Agent Path

This can become a simple Phase 2 Agent:

1. User asks an agent to do work.
2. Agent calls another specialized provider agent.
3. Provider returns the result.
4. Caller pays through this Skill.
5. Pharos records the receipt.
6. A reputation agent ranks providers by paid completed work.
