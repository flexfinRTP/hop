# Hop

Confidential lending-risk query for ETHOnline 2026 (Classic, from-scratch). One paid hop: 402 → Hedera exact → CRE join → evidence.

Public contract: [`openapi/openapi.yaml`](openapi/openapi.yaml) and this README. Product spec, agent prompts, and threat model live in local `docs/` / `THREAT.md` (gitignored).

Partners (three): Chainlink CRE `handlerInTee` · Hedera Blocky402 (HBAR `0.0.0` / HTS) · The Graph (two live Messari lending 3.1.0 protocols).

Pitch: audit-ready evidence for agent tool use. Not “compliant AI.”

**Init only.** Routes return `501 not_implemented`. Paid 402 path, live Graph join, and CRE sim wiring are next.

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
CRE handlerInTee (CLI sim until live DON)
    │  1. load private policy table (secret)
    │  2. fetch live Graph (two protocols, schema 3.1.0)
    │  3. join + aggregate  (no Account.id, no caps out)
    ▼
200 aggregate + evidence hashes
    │
    ▼
GET /v1/evidence/{id}   (public: hashes, Graph block, settlement ref)
```

Graph is the public join key. The confidential input is the policy table inside CRE. Empty table = `policy_unavailable` (503, not charged).

Badge until a live DON: `CRE: simulation`. Rails label: `data: Graph (EVM) · pay: Hedera`.

## Layout

| Path | Role |
| --- | --- |
| `apps/api` | `POST /v1/query`, `GET /v1/evidence/{id}` |
| `apps/web` | Workbench (labels only) |
| `cre/hop-query` | CRE workflow: `handlerInTee` |
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

Charge table: unpaid/bad payload = no charge. Missing policy = 503, no charge. `stale` and `k_anon_denied` = HTTP 200, **charged**. No invented refunds.

## Graph

Two live Messari Lending/CDP **3.1.0** subgraphs (intended: Aave v3 + Compound v3). IDs go in `.env` **after** deployments are verified. Do not ship dead IDs. Evidence must record deployment id + `schemaVersion` + block.

`Market.maximumLTV` is a protocol parameter, not a wallet’s current LTV. No `Position.ltv` / `healthFactor` in this schema.

## CRE

From `cre/` (needs [CRE CLI](https://docs.chain.link/cre) + Bun):

```bash
cd cre/hop-query && bun install && cd ..
cp .env.example .env   # CRE_ETH_PRIVATE_KEY + HOP_POLICY_TABLE_JSON
cre workflow simulate hop-query --target staging-settings
```

CLI simulation qualifies for this event. Deploy to DON is invite-only. Stub `handler` (non-TEE) = Chainlink miss. Workflow **binary is not confidential**.

## Setup (owner)

Do not start this in the agent session unless asked.

```bash
cp .env.example .env
npm install
npm run dev:api
npm run dev:web
```

Workbench: http://localhost:5173 · API: http://localhost:8787

## Out of scope (this repo)

Combo desk, Arduino, Shopify/Zapier marketplace, custom lending pool, Arc/Privy/Ledger as prize slots, Graph Base USDC 402, WALL/ATS until one paid query works.

## Attribution

Built with AI assistance in Cursor for ETHOnline 2026.
