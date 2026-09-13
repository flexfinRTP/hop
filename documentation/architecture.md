# Architecture

## Components

| Path | Responsibility |
| --- | --- |
| `apps/api` | Hono HTTP API: 402 quotes, Blocky402 verify/settle, CRE launch, evidence store |
| `apps/web` | `/` product, `/app` decision room |
| `apps/mcp` | MCP server over the same HTTP contract |
| `cre/hop-query` | CRE TypeScript workflow, `handlerInTee` |
| `packages/shared` | GraphQL, snapshot fetch, join, sanitizer, meter, mandate, PEAC |
| `skills/hop-query` | Agent skill for the 402 retry |
| `openapi/openapi.yaml` | Public HTTP contract |

## Query types

Hop accepts only these values in `POST /v1/query`.

| `query` | Public output | Notes |
| --- | --- | --- |
| `policy_check` | `{ breached, observed, metric_hash, k_anon }` plus protocol totals | Default product path. Cap values are never returned. |
| `market_params` | Per-protocol TVL, borrow, deposit, utilization, LTV-parameter histogram, sample borrow rate | Uses `Market.maximumLTV` as a **protocol parameter**, not a wallet LTV. |
| `position_counts` | Open collateral vs borrower counts | Messari `Position.side` is `COLLATERAL` \| `BORROWER`. |
| `liquidations` | Count and `amountUSD` in the requested window | |
| `account_ltv` | k-anonymous LTV bins (`k ≥ 5`) | Computed from balances × prices. Schema has no `Position.ltv` / `healthFactor`. |

Utilization:

```text
utilization = totalBorrowBalanceUSD / totalDepositBalanceUSD
```

`scope: all` on a utilization cap requires every selected protocol to satisfy the operator. The default house table is both books `gt 0.78`.

## Source selection

```http
GET /v1/meta
```

```json
{
  "schemaVersion": "3.1.0",
  "protocols": [
    {
      "key": "aave-v3",
      "slug": "aave-v3-ethereum",
      "id": "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
      "configured": true
    },
    {
      "key": "compound-v3",
      "slug": "compound-v3-ethereum",
      "id": "AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9",
      "configured": true
    }
  ]
}
```

The caller must send those `key` values. Unconfigured keys return `503 graph_unconfigured` before settlement.

## Charge table

| Condition | HTTP | Settled |
| --- | --- | --- |
| No `X-PAYMENT` | 402 | No |
| Bad payment payload | 400 `bad_payment` | No |
| Missing `Idempotency-Key` on paid retry | 400 `idempotency_required` | No |
| Same idempotency key, same body | 200 | No (replay of evidence) |
| Same key, different body | 400 `idempotency_conflict` | No |
| Payment payload reused under a new key | 400 `payment_replay` | No |
| Empty policy table | 503 `policy_unavailable` | No |
| Graph source missing | 503 `graph_unconfigured` | No |
| CRE CLI unavailable (`HOP_JOIN=cre`) | 503 `cre_unavailable` | No |
| Facilitator `/supported` down | 503 `facilitator_unavailable` | No |
| Merchant `payTo` unset | 503 `merchant_unconfigured` | No |
| Payer not allowlisted | 403 `payer_denied` | No |
| Mandate deny / expired / over budget | 403 | No |
| Mandate human threshold | 403 `mandate_review` | No until `X-Hop-Confirm: 1` |
| Rate limit | 429 | No |
| Block lag, indexing error, missing methodology/block timestamp, unevaluable metric | 200 `stale` | Yes |
| k-anonymity fail | 200 `k_anon_denied` | Yes |
| Policy breached | 200 `reject` | Yes |
| Policy clear | 200 `accept` | Yes |

There are no refunds. `stale` and `k_anon_denied` are charged outcomes (charge-for-attempt). The `/` CTA “One paid request. One decision receipt.” is the product sentence, not a refund SLA. Agents persist `receipt.evidence_id` on every 200, including stale.

## Join modes

`HOP_JOIN` defaults to `cre` unless set to `inline`.

| Mode | Behavior |
| --- | --- |
| `cre` | `cre workflow simulate hop-query --target api-settings`. No silent fallback to the in-process join. |
| `inline` | Same `joinAndAggregate` in the API process. Local development only. |

`CRE_WORKFLOW_ID` may additionally POST `workflows.execute` to the CRE gateway. Hop then polls `cre execution status` (and events if needed) for that `workflow_execution_id`. `cre.mode` stays `"simulation"` unless the retrieved execution is `SUCCESS` **and** its `cre_commitment_hash` matches the simulation commitment. A trigger acknowledgement is never a DON result. Overwriting `artifact` with the execution id is forbidden (`cre_ok` requires `handlerInTee`).

## Repository layout vs runtime

```text
packages/shared/src/graphql.ts     Messari 3.1.0 operations
packages/shared/src/snapshot.ts    Gateway fetch, pagination, freshness
packages/shared/src/join.ts        Cross-protocol aggregation
packages/shared/src/egress.ts      Public-output sanitizer
packages/shared/src/meter.ts       Protocol-count price
apps/api/src/x402.ts               Blocky402 /supported /verify /settle
apps/api/src/hcs.ts                Topic create + hash submit
cre/hop-query/main.ts              handlerInTee
cre/secrets.yaml                   POLICY_TABLE, GRAPH_API_KEY
```
