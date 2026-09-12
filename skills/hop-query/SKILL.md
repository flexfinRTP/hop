---
name: hop-query
description: Paid Hop confidential lending-risk query over Hedera x402 + live Graph + CRE policy table. Use when an agent needs policy_check / market_params / position_counts / liquidations / account_ltv without exporting wallets or caps.
---

# Hop query

OpenAPI: `openapi/openapi.yaml`. API default `http://localhost:8787`.

## Rules

- Fixed query types only. No SQL/GraphQL from the client.
- Client MUST use Hedera exact (`@x402/hedera` ExactHederaScheme). Not Graph Base USDC x402.
- `extra.feePayer` from facilitator `GET /supported`. Do not hardcode.
- Idempotency-Key required on paid retry. Same key → same evidence, no second settle.
- Optional `mandate_json` / env `HOP_MANDATE_JSON`. Deterministic budget. LLM never raises the cap or pays.
- `confirm=true` only after HTTP 403 `mandate_review`.
- Optional `world_token` from `POST /v1/world/verify`. Required when API `WORLD_REQUIRED=1`.
- Never ask for or return Account.id or policy cap values. Metric names are hashed.

## Flow

1. `hop_meta` then `hop_mandate` (remaining budget).
2. `POST /v1/query` with `{ query, protocols, max_block_lag }` → 402 `accepts[]`.
3. Sign Hedera exact payload. Retry with `X-PAYMENT` + `Idempotency-Key` + mandate.
4. 200: aggregate + evidence hashes. `hop_evidence` / `hop_peac` / `hop_verify`.

MCP: `hop_query`, `hop_evidence`, `hop_peac`, `hop_verify`, `hop_mandate`, `hop_meta`, `hop_world_rp_context`, `hop_world_verify` (`npm start -w @hop/mcp`).
