# Chainlink Sepolia liquidation challenge

Hop’s second CRE workflow is the live ETHOnline 2026 liquidation-protection challenge. It is not the generic mock `/risk-state` template.

Extra track. Not the Hop SKU. Why you buy Hop: [`language.md`](language.md).

Official addresses ([ETHGlobal Chainlink prize](https://ethglobal.com/events/ethonline2026/prizes/chainlink), [challenge repo](https://github.com/solangegueiros/cf-liquidation-protection-challenge)):

| Contract | Address |
| --- | --- |
| ChallengeLending | `0x88574e7Cc0027afd04951daa09B64d4441931ba1` |
| vETH | `0x5dED1a40c3D56dA42E7f932f781c0432556c9814` |
| vUSD | `0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2` |

Token decimals are 2 (`100 = 1.00`). HF is stored ×100. Liquidation threshold is 78.

## Workflow

`cre/liquidation-protection/main.ts` registers `handlerInTee` on a cron trigger (Nitro `us-west-2`). Inside the enclave it:

1. Reads Vault secrets (RPC, executor key, HF triggers, repay/deposit caps, priority, cooldown, commitment salt)
2. Reads `getUserPosition`, `vETHPrice`, balances over JSON-RPC
3. Plans `repay` and/or `deposit` only (the challenge’s permitted defensive actions)
4. Sends raw Sepolia transactions
5. Reports a public commitment hash, not the private thresholds

Config (`config.staging.json` / `config.production.json`) pins the official challenge addresses, not personal example deployments.

## Join

```bash
# requires LIQUIDATION_RPC_URL and LIQUIDATION_EXECUTOR_PRIVATE_KEY
npx tsx cre/liquidation-protection/join.ts
```

`join()` succeeds only while `challengeOpen == true` and the wallet is not already a user.

## Status

```http
GET /v1/liquidation
```

Live `eth_call` against ChallengeLending: open flag, join status, stored and live HF, reserves, continuity score.

## Simulate

```bash
cd cre
cre workflow simulate liquidation-protection --target staging-settings --non-interactive --trigger-index 0
# writes:
cre workflow simulate liquidation-protection --target staging-settings --non-interactive --trigger-index 0 --broadcast
```
