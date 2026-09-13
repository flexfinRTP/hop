# Hop

**Sunset 0.1.0.** Archive. No further product work. How to run what shipped: [`documentation/operator.md`](documentation/operator.md). Language lock: [`documentation/language.md`](documentation/language.md).

Hop is verifiable decision infrastructure for agents.

A caller selects a fixed query type and one or two lending protocols (the finance demo: Aave v3 + Compound v3), pays an x402 `exact` quote on Hedera, and receives a sanitized decision plus a public evidence pack. Policy evaluation is confidential. Settlement is public. Graph data is public. The receipt says what was and was not verified.

The join runs in a Chainlink Runtime Environment confidential workflow: live Messari Lending/CDP **3.1.0** data from The Graph is compared to a private policy table. Policy values never appear in HTTP responses.

Hop does not parse natural language, execute caller GraphQL, or hold the payer’s keys. Hop does not provide private payments.

**Enterprise:** put it in because an agent that can move value without a receipt is an uninsured process. Audit gets a link, not a screenshot of a chat. One hop in front of the irreversible tool call.

**Agent workflow:** the tool call before the tool call that cannot be undone. One 402-retry. Verdict + receipt. Not on every token — on spend, bind, or actuate. Full why: [`documentation/language.md`](documentation/language.md).

## Documentation

| Document | Contents |
| --- | --- |
| [`documentation/language.md`](documentation/language.md) | Protocol language — commercial source of truth |
| `/docs` | Human docs hub: point your agent, Swagger, articles |
| `/swagger.html` | Hosted Swagger UI for `openapi.yaml` |
| [`documentation/README.md`](documentation/README.md) | Index, trust boundary, identifiers |
| [`documentation/judge.md`](documentation/judge.md) | Judge pack: scoreable tape + standards |
| [`documentation/operator.md`](documentation/operator.md) | Manual activation and demo tape |
| [`documentation/architecture.md`](documentation/architecture.md) | Query types, charge table, join modes |
| [`documentation/hedera-x402.md`](documentation/hedera-x402.md) | Blocky402 `exact`, meter, client/server |
| [`documentation/the-graph.md`](documentation/the-graph.md) | Standardized schema, Gateway queries |
| [`documentation/chainlink-cre.md`](documentation/chainlink-cre.md) | `handlerInTee`, secrets, simulate vs DON |
| [`documentation/hedera-ats.md`](documentation/hedera-ats.md) | ATS v8 factory/resolver, bond lifecycle |
| [`documentation/chainlink-liquidation.md`](documentation/chainlink-liquidation.md) | Official Sepolia challenge workflow |
| [`documentation/agents.md`](documentation/agents.md) | MCP, skill, mandate, passport, Agent Card |
| [`documentation/identity.md`](documentation/identity.md) | Hop passports, DID, ERC-8004, HITL |
| [`documentation/demo-script.md`](documentation/demo-script.md) | 3-minute live tape |
| [`documentation/evidence.md`](documentation/evidence.md) | Receipts, HCS, PEAC, verify |
| `/pitch.html` | Pitch deck |
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | HTTP contract |
| [`skills/hop-query/SKILL.md`](skills/hop-query/SKILL.md) | Agent retry procedure |
| [`AI.md`](AI.md) | AI-assisted implementation attribution |

## Architecture

```text
Caller
  POST /v1/query
        │
        ▼
Hop API ── 402  scheme=exact  network=hedera:testnet  asset=0.0.0
        │         extra.feePayer ← GET {Blocky402}/supported
        │  X-PAYMENT + Idempotency-Key
        ▼
Blocky402 /verify → /settle
        ▼
CRE handlerInTee (HTTP, Nitro us-west-2)
        │  getSecret(POLICY_TABLE)
        │  live Graph HTTP (TeeRuntime)
        │  join + sanitize
        │  usingTheDons().report(commitment)
        ▼
200 { status, aggregate, evidence }  + optional HCS
```

Public data plane: The Graph. Confidential input: policy table. Payment rail: Hedera HBAR (`0.0.0`) or HTS. Not Graph Base USDC x402.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev:api    # http://localhost:8787
npm run dev:web    # http://localhost:5173
```

Required for a live join: Hedera testnet payer/merchant, Blocky402 reachable, `GRAPH_API_KEY`, `HOP_POLICY_TABLE_JSON`, and (when `HOP_JOIN=cre`) an authenticated CRE CLI.

```bash
cd cre
cre workflow simulate hop-query \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --http-payload @hop-query/http-payload.json \
  --env ./.env
```

Do not start API or web from an unattended agent session unless asked.

## HTTP

```http
POST /v1/query
GET  /v1/meta
GET  /v1/mandate
GET  /v1/identity/passports
GET  /v1/evidence?limit=50
GET  /v1/evidence/{id}
GET  /v1/evidence/{id}/peac
GET  /v1/evidence/{id}/verify
GET  /verify/{id}
GET  /.well-known/agent-card.json
GET  /.well-known/did.json
GET  /.well-known/oauth-protected-resource
GET  /.well-known/agent-registration.json
```

Unpaid query:

```bash
curl -sS http://localhost:8787/v1/query \
  -H "content-type: application/json" \
  -d '{"query":"policy_check","protocols":["aave-v3","compound-v3"],"max_block_lag":50}'
```

HTTP 402 body: `accepts[]` with `scheme`, `network`, `asset`, `amount`, `payTo`, `extra.feePayer`. Sign with `@x402/hedera` `ExactHederaScheme`. Retry with `X-PAYMENT` (base64 PaymentPayload) and `Idempotency-Key`.

Empty policy or missing Graph URLs or missing CRE CLI (cre mode) fail **before** settle (`503`). `stale` and `k_anon_denied` are HTTP 200 and **are** settled. No refunds.

## Data

Two Gateway subgraphs, one Messari schema:

| Key | Protocol | Subgraph ID |
| --- | --- | --- |
| `aave-v3` | Aave v3 Ethereum | `JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk` |
| `compound-v3` | Compound v3 Ethereum | `AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9` |

Evidence stores `subgraphId`, `schemaVersion`, `methodologyVersion`, block number, and block timestamp. `Market.maximumLTV` is a protocol parameter. This schema has no `Position.ltv` / `healthFactor`.

## Confidential compute

Default `HOP_JOIN=cre`. Paid hops run `cre workflow simulate` (`handlerInTee`, live HTTP). There is no silent inline fallback on that path. `HOP_JOIN=inline` is local join without the CLI.

CLI simulation is not a hardware TEE. Workflow WASM is not confidential. `usingTheDons().report()` carries hashes and public Graph identifiers only. `cre.report_hash` is Hop’s SHA-256 of that commitment.

## Agents

Point an agent at [`llms.txt`](llms.txt), [`openapi/openapi.yaml`](openapi/openapi.yaml), or [`skills/hop-query/SKILL.md`](skills/hop-query/SKILL.md). It pays Hedera exact x402 and calls `POST /v1/query` in seconds. No SDK. No API key. No login. Optional `X-Hop-Did` stamps the receipt.

Human hub: `/docs`. Judge pack: `/docs/judge`. Hosted Swagger: `/swagger.html`. MCP tools: `hop_meta`, `hop_mandate`, `hop_query`, `hop_evidence`, `hop_peac`, `hop_verify`, `hop_passport_issue`, `hop_passport_get`, `hop_passport_bind`, `hop_passport_revoke`, `hop_world_rp_context`, `hop_world_verify`. Discovery: `GET /.well-known/agent-card.json`, `GET /.well-known/did.json`.

Mandates are deterministic budgets. The model does not pay.

## Live settlement example

https://hashscan.io/testnet/transaction/0.0.7162784-1789187260-227607013

Payer `0.0.10490510`. Graph identifiers and CRE artifact are on the evidence pack. HCS anchors hashes when operator keys are set.

## Posture

Non-custodial · OFAC not screened · testnet payee. Not MSB/CASP/RIA. WALL/ATS is a simulated secondary view of an already-paid aggregate.
