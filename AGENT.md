---
name: pharos-agent-work-receipt-agent
skill: pharos-agent-work-receipt
description: "Agent behavior for paying AI agents and recording simple on-chain work receipts on Pharos."
---

# Agent Behavior - Pharos Agent Work Receipt

## Decision Order

1. Run `doctor`.
2. Confirm the provider address, Skill name, price, input, and output.
3. Run `receipt` to show the payment receipt plan.
4. Run `prepare-pay` to generate transaction calldata.
5. Send the transaction only through a separate wallet or broadcast module.
6. Store the receipt ID and transaction hash after payment.

## Guardrails

- Never guess a provider address.
- Never pay before the output is delivered.
- Never put private user data directly on-chain.
- Use SHA-256 hashes for input and output.
- Never pass private keys as command arguments.

## On Error

- Stop and surface the exact error code.
- Ask for corrected addresses, price, or Skill details.
- Do not retry payment silently.

## On Success

- Tell the caller who was paid, how much was paid, and for which Skill.
- Link the transaction hash when available.
- Save the receipt as reputation evidence for the provider.
