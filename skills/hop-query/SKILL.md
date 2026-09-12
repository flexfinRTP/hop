---
name: hop-query
description: Paid Hop confidential lending-risk query over Hedera x402 + live Graph + CRE policy table. Use when an agent needs policy_check / market_params / position_counts / liquidations / account_ltv without exporting wallets or caps.
---

# Hop query

OpenAPI: `openapi/openapi.yaml`. API default `http://localhost:8787`.

## Rules

- Hop is a deterministic query service, not an LLM or agent orchestrator. The caller agent must
  map natural language to a supported query type and explicitly choose one or two configured
  protocol keys. Hop does not interpret free text or choose a hidden data source.
- Fixed query types only. No SQL/GraphQL from the client.
- Call `hop_meta` first to discover configured protocol keys and availability.
- Client MUST use Hedera exact (`@x402/hedera` ExactHederaScheme). Not Graph Base USDC x402.
- `extra.feePayer` from facilitator `GET /supported`. Do not hardcode.
- Idempotency-Key required on paid retry. Same key → same evidence, no second settle.
- Optional `mandate_json` / env `HOP_MANDATE_JSON`. Deterministic budget. LLM never raises the cap or pays.
- `confirm=true` only after HTTP 403 `mandate_review`.
- Optional `world_token` from `POST /v1/world/verify`. Required when API `WORLD_REQUIRED=1`.
- Never ask for or return Account.id or policy cap values. Metric names are hashed.
- If CRE mode is configured but the runner is unavailable, stop on `503 cre_unavailable`; no payment should be attempted.

## Flow

1. `hop_meta` then `hop_mandate` (remaining budget).
2. Map the user's request to `{ query, protocols, max_block_lag }`, then `POST /v1/query` → 402 `accepts[]`.
3. Sign Hedera exact payload. Retry with `X-PAYMENT` + `Idempotency-Key` + mandate.
4. 200: aggregate + evidence hashes. `hop_evidence` / `hop_peac` / `hop_verify`.

MCP: `hop_query`, `hop_evidence`, `hop_peac`, `hop_verify`, `hop_mandate`, `hop_meta`, `hop_world_rp_context`, `hop_world_verify` (`npm start -w @hop/mcp`).
