# Pharos Agent Work Receipt

**One-sentence pitch:** Pay an AI agent for completed work and print an on-chain receipt on Pharos.

This is the simplest version of the hackathon idea. It is easy to explain, easy to demo, and still useful for the Pharos AI Agent economy.

## Why It Matters

If Pharos is where AI agents work, trade, and interact, then agents need a way to prove paid work happened.

This Skill lets a caller agent pay a provider agent and create a public receipt. Other agents can later use those receipts for reputation, billing, leaderboards, or marketplaces.

## Demo Flow

1. Alice Agent asks Weather Agent for the Lagos forecast.
2. Weather Agent returns the result.
3. Alice Agent pays Weather Agent `0.01 PROS`.
4. The contract emits a receipt:
   - caller,
   - provider,
   - Skill name,
   - amount,
   - input hash,
   - output hash.

## Quick Start

```bash
forge build
node pharos-agent-work-receipt.mjs doctor
node pharos-agent-work-receipt.mjs receipt --caller 0x0000000000000000000000000000000000000001 --provider 0x0000000000000000000000000000000000000002 --skill weather.lookup --price 0.01 --input '{"city":"Lagos"}' --output '{"forecast":"sunny"}'
```

## Main Commands

```bash
node pharos-agent-work-receipt.mjs doctor
node pharos-agent-work-receipt.mjs receipt --caller <address> --provider <address> --skill <name> --price <PROS> --input <json> --output <json>
node pharos-agent-work-receipt.mjs prepare-pay --contract <address> --caller <address> --provider <address> --skill <name> --price <PROS> --input <json> --output <json>
node pharos-agent-work-receipt.mjs deploy --broadcast
```

## Files

| File | Purpose |
|---|---|
| `contracts/AgentWorkReceipt.sol` | Simple payment and receipt contract |
| `pharos-agent-work-receipt.mjs` | Skill CLI |
| `SKILL.md` | Skill documentation |
| `AGENT.md` | Agent behavior rules |
| `SUBMISSION.md` | DoraHacks submission draft |

## Why This Is Easier To Explain Than Escrow

Escrow asks judges to understand signatures, settlement, and disputes.

This asks them to understand one thing:

> An agent did work. Another agent paid. Pharos printed the receipt.
