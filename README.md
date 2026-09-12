# Hop

Confidential lending-risk query for ETHOnline 2026 (Classic, from-scratch). One paid hop: 402 → Hedera exact → CRE join → evidence.

Public contract: [`openapi/openapi.yaml`](openapi/openapi.yaml) and this README. Product spec, agent prompts, and threat model live in local `docs/` / `THREAT.md` (gitignored).

Partners (three): Chainlink CRE `handlerInTee` · Hedera Blocky402 (HBAR `0.0.0` / HTS) · The Graph (two live Messari lending 3.1.0 protocols).

Pitch: audit-ready evidence for agent tool use. Not “compliant AI.”

Paid path: `POST /v1/query` → 402 → Blocky402 verify/settle → CRE join (inline engine or `HOP_JOIN=cre`) → evidence. `GET /v1/evidence/{id}` is public hashes.

## Architecture

```text
UI / agent
    │  POST /v1/query  (no X-PAYMENT)
    ▼
Hop API ── 402 PaymentRequirements
    │         network: hedera:testnet
    │         asset: "0.0.0" (or HTS id)
    │         extra.feePayer ← GET Blocky402 /supported
    │
    │  retry + X-PAYMENT + Idempotency-Key
    ▼
CRE handlerInTee (HTTP trigger, Nitro us-west-2)
    │  1. getSecret POLICY_TABLE inside the enclave
    │  2. live Graph HTTP from TeeRuntime (two Messari 3.1.0 protocols)
    │  3. join + aggregate (no Account.id, no caps, metric hashed)
    │  4. usingTheDons().report() hashes + stamp only
    ▼
200 aggregate + evidence hashes (+ HCS commitments)
```

Graph is the public join key. The confidential input is the policy table inside CRE. Empty table = `policy_unavailable` (503, not charged).

Badge until a live DON: `CRE: simulation`. Rails label: `data: Graph (EVM) · pay: Hedera`.

## Layout

| Path | Role |
| --- | --- |
| `apps/api` | `POST /v1/query`, `GET /v1/evidence/{id}`, `GET /v1/meta` |
| `apps/web` | `/` marketing · `/app` console · `/desk` night desk |
| `apps/mcp` | MCP `hop_query` / `hop_evidence` |
| `cre/hop-query` | CRE workflow: `handlerInTee` |
| `skills/hop-query` | Agent SKILL for the 402 retry |
| `openapi/openapi.yaml` | Contract |
| `llms.txt` | Pointer to OpenAPI |

## Hedera payment flow (Blocky402)

Facilitator: `https://api.testnet.blocky402.com`

1. `GET /supported` (no auth). Read Hedera `exact` kind. Set `extra.feePayer` to `kinds[].extra.feePayer` or `signers["hedera:*"][0]`. **Must match.** Do not hardcode.
2. Server 402 `PaymentRequirements`: `scheme: exact`, `network: hedera:testnet`, `asset: "0.0.0"` (HBAR tinybars) or an HTS token id, `payTo` = merchant account, `amount` in tinybars.
3. Client signs with Hedera exact — not a generic EVM/USDC `fetchWithPayment`:

```ts
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";

const scheme = new ExactHederaScheme(signer);
const signed = await scheme.createPaymentPayload(2, requirements);
// retry POST /v1/query with X-PAYMENT (base64 PaymentPayload) + Idempotency-Key
```

4. API `POST` facilitator `/verify` then `/settle`. Store settlement ref on evidence.
5. Same `Idempotency-Key` → same evidence id, **no second settle**.

Do not proxy Graph’s Base USDC x402. That is not the Hedera prize.

- Unpaid/bad payload = no charge. Missing policy = 503, no charge. `stale` and `k_anon_denied` = HTTP 200, **charged**. No invented refunds.
- Workbench may call `POST /v1/demo/sign` when `HOP_DEMO_SIGN=1` (demo payer keys in `.env`). That still produces a real Blocky402 payload. Agents should send `X-PAYMENT` themselves.

## Graph

Two live Messari Lending/CDP **3.1.0** subgraphs (intended: Aave v3 + Compound v3). IDs go in `.env` **after** deployments are verified. Do not ship dead IDs. Evidence must record deployment id + `schemaVersion` + block.

`Market.maximumLTV` is a protocol parameter, not a wallet’s current LTV. No `Position.ltv` / `healthFactor` in this schema.

## CRE

Default `HOP_JOIN=cre`: paid hop runs `cre workflow simulate hop-query --non-interactive --trigger-index 0 --http-payload ...` (WASM `handlerInTee`, live Graph/RPC). No inline fallback on that path. Set `HOP_JOIN=inline` only for local join without the CRE CLI.

CLI simulation is the ETHOnline-qualified TEE path and makes live HTTP calls. Live DON: set `CRE_WORKFLOW_ID` (invite) to also POST `workflows.execute` to the CRE gateway. Stub `handler` (non-TEE) = Chainlink miss. Workflow **binary is not confidential**. `usingTheDons().report()` crosses only hashes + stamp.

```bash
cd cre/hop-query && bun install && cd ..
cp .env.example .env   # CRE_ETH_PRIVATE_KEY + HOP_POLICY_TABLE_JSON + GRAPH_API_KEY
cre workflow simulate hop-query --target staging-settings --non-interactive --trigger-index 0 --http-payload @hop-query/http-payload.json
```

## Setup (owner)

Do not start this in the agent session unless asked.

```bash
cp .env.example .env
npm install
npm run dev:api
npm run dev:web
```

Workbench: http://localhost:5173 · API: http://localhost:8787

## Live testnet example

Paid `policy_check` (Hedera testnet, Blocky402 settle):

https://hashscan.io/testnet/transaction/0.0.7162784-1789187260-227607013

Payer `0.0.10490510`. CRE is `handlerInTee` HTTP + Nitro; CLI sim until `CRE_WORKFLOW_ID` is set. Graph deployments and block are on the evidence pack. HCS anchors hashes when operator keys are set.

## World ID

Optional unique-human gate (not KYC). `POST /v1/world/rp-context` then IDKit, `POST /v1/world/verify` (World `/api/v4/verify/{rp_id}`), `X-Hop-World` on the paid hop. Evidence stores SHA-256 of the nullifier only. `WORLD_REQUIRED=1` to require it.

## Mandate (agents)

Deterministic. The model does not authorize pay.

- Header `X-Hop-Mandate` (JSON or base64) or server default `HOP_MANDATE_JSON`
- Checks: expiry, merchant `payTo`, query allowlist, freshness cap, per-call, budget, velocity
- `human_threshold_tinybars` → HTTP 403 `mandate_review` until `X-Hop-Confirm: 1`
- Over budget / expired → 403, **no settle**

MCP: `hop_query`, `hop_evidence`, `hop_peac`, `hop_verify`, `hop_mandate`, `hop_meta`.

## Receipts

- `GET /v1/evidence/{id}` — hashes, settlement, chain, mandate hash
- `GET /v1/evidence/{id}/peac` — PEAC-shaped portable receipt
- `GET /v1/evidence/{id}/verify` — recompute aggregate hash
- HCS: set `HOP_HCS_AUTO=1` (or `HEDERA_HCS_TOPIC`) plus operator keys

Posture labels: non-custodial · OFAC not screened · testnet payee. Not MSB/CASP/RIA. WALL ATS is simulated.