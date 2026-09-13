# Hop product implementation plan

Status: **Phases A–E shipped (0.0.66–0.0.69).** Remaining core is **G operator tape**, then **F/H**. Implement in order. Each phase should stay shippable.

This is the executable spec for remaining core product / code. Do not start extra verticals, KYC, Stripe, Graph Base USDC x402, ATS-as-the-pitch, or Prova TDX unless a later review reopens them.

## Locked positioning (do not drift)

- Category: **verifiable decision infrastructure for agents.**
- Primary: before an agent acts, get a decision with a receipt.
- Supporting (live on `/`): private policy. Public settlement. Verifiable evidence.
- Demo vertical: finance — pre-action lending policy gate (Aave v3 + Compound v3, `policy_check`).
- Audience: agents and agent platforms. Not DeFi risk desks or treasury engineering teams.
- Payments: **public** Hedera testnet x402 (visible settlement, payer, amount). Not private payments.
- What is private: policy evaluation / decision logic. Policy values are omitted from public responses.

Honest boundary to keep everywhere:

> Decision is private. Payment is public on Hedera. Data source is public on The Graph. Receipt says what was and was not verified.

---

## 0. What is already true in code

Hop is a Hedera-paid confidential **policy-query gateway**. It is not Prova Finance x402 (no Stripe, no KYC wrap, no FINRA claim). It is not private payments.

```text
POST /v1/query
  → HTTP 402 (exact / hedera:testnet / HBAR 0.0.0)
  → X-PAYMENT + Idempotency-Key
  → Blocky402 /verify then /settle
  → CRE: cre workflow simulate hop-query (handlerInTee, Nitro us-west-2)
       optional DON trigger attached; simulation result retained
  → HTTP 200 { status, aggregate, evidence }
  → optional HCS commit of hashes
```

Default `HOP_JOIN=cre`. `inline` is local-only.

Query types (keep all): `market_params`, `position_counts`, `liquidations`, `policy_check`, `account_ltv`.

Surfaces: `/` Landing, `/docs` docs hub + Swagger, `/app` CommandCenter, `/assets` ATS studio.

### Shipped (do not redo)

| Version | What exists |
| --- | --- |
| 0.0.59 | Fail-closed stale; CRE sim vs DON trigger honesty in join-run; sanitization; concurrent settlement claims |
| 0.0.61 | `documentation/`; Agent Card; Graph `_meta.deployment` vs subgraph id |
| 0.0.62 | Postgres evidence store; Hedera Mirror Node verify (`hedera-mirror.ts`); `hop_pay`; `POLICY_COMMITMENT_SALT`; `cre_commitment_hash`; HCS outbox |
| 0.0.63–0.0.64 | ATS v8 studio + harness; `/app` infra ATS counts + Sepolia ChallengeLending |
| **0.0.66** | Positioning on `/`, `/app`, desk labels, README, OpenAPI, SKILL, MCP, Agent Card. Evidence docs match Mirror Node verify. |
| **0.0.67** | Verify tiers on `GET /v1/evidence/{id}/verify` and `/app` vault chips |
| **0.0.69** | CRE retrieve-and-match; charge-for-attempt on `receipt.charge`; additive `hop.decision.v1` on `/v1/query` and verify. |
| **0.0.70** | `/docs` hub + hosted Swagger. Point-your-agent copy on `/` and agent files. API serves llms/OpenAPI/SKILL/docs. |

`GET /v1/evidence/{id}/verify` already:

- recomputes aggregate / chain / predecessor / PEAC
- structural CRE check (`mode` simulation\|don, http, nitro, handlerInTee, 64-char hash)
- Mirror Node settlement + optional HCS (`verifyEvidenceExternally`)
- folds those into overall `ok`
- caches ~60s; `?refresh=1`

`cre.mode` in `apps/api/src/join-run.ts` stays `"simulation"` on a DON trigger ACK. It becomes `"don"` only after `cre execution status` is SUCCESS and `cre_commitment_hash` matches.

### Charge table today (`documentation/architecture.md`)

Settle happens **before** join. `stale` and `k_anon_denied` are charged. No refunds. Landing says “one paid request / one decision receipt” as the product sentence, not a refund guarantee. Document that honestly in Phase D; do not implement silent refunds.

---

## 1. Phase A — done (0.0.66)

Copy only. No API schema change. Layout preserved.

| Surface | After |
| --- | --- |
| `/` H1 | Private policy. Public settlement. Verifiable evidence. |
| `/` sub | Verifiable decision infrastructure for agents. Demo: lending policy gate. |
| `/` caps | NO API KEY / POLICY OMITTED / PUBLIC SETTLEMENT / MANDATE GATED |
| `/` preview CRE | CRE simulation · SIM |
| `/` preview Graph | Standardized join |
| `/app` eyebrow / H1 | FINANCE DEMO / Decision room |
| `/app` step 03 | CRE confidential workflow · simulation |
| `/app` step 04 | Standardized Graph join |
| `/app` CRE badge | SIM unless `cre.mode === "don"` |
| HCS | Anchored only if `hcs_seq` present; otherwise optional / hash chain |

Keep: five-stage pipeline, Evidence Vault, Infrastructure, VERIFY HASHES, mandate/HITL, demo-signer, ATS studio link, desk, all query types.

---

## 2. Remaining core product / code (do these)

Implement **G (operator tape)**. Phases B–E shipped in 0.0.67–0.0.69.

---

### Phase B — Verification tiers (API + UI)

**Goal:** a receipt states **what was and was not verified**. Do not treat structural CRE as DON proof.

**Why:** `/` now sells a decision with a receipt. Verify currently returns a single `ok` plus booleans. UI `VerifyBanner` shows one green HASH CHECK PASSED including `CRE OK`, which buyers read as TEE/DON proof. `cre_ok` is only structural.

#### B1. Types

File: `packages/shared/src/types.ts`

Add next to `ExternalVerification`:

```ts
export const VERIFICATION_TIERS = [
  "recomputed",
  "settlement_confirmed",
  "hcs_confirmed",
  "cre_simulation",
  "cre_don_verified",
] as const;

export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

export type VerificationTiers = Record<VerificationTier, boolean>;

export type VerifyMeans = {
  ok_means: "local_hashes_and_public_settlement";
  cre_ok_means: "structural_simulation_fields";
};
```

Do **not** set `cre_don_verified: true` in this phase.

#### B2. Verify handler

File: `apps/api/src/routes/evidence.ts` — `GET /:id/verify`

Keep every existing boolean (`ok`, `aggregate_ok`, `chain_ok`, `predecessor_ok`, `peac_ok`, `cre_ok`, `settlement_ref_present`, `external_settlement_verified`, `external_hcs_verified`, `verification`, `id`, `settlement`, `peac_hash`, `hcs_seq`, `cre`, `world`).

Add:

```ts
const tiers = {
  recomputed: aggregate_ok && chain_ok && predecessor_ok && peac_ok,
  settlement_confirmed: externalSettlement,
  hcs_confirmed: externalHcs, // true when no hcs_seq (nothing to confirm)
  cre_simulation: cre_ok && row.json.cre?.mode === "simulation",
  cre_don_verified: false, // Phase C later
};

return c.json({
  ok: /* unchanged formula */,
  tiers,
  ok_means: "local_hashes_and_public_settlement",
  cre_ok_means: "structural_simulation_fields",
  // ...existing fields
});
```

Rules:

- Keep `ok` as today: local hashes + public settlement + HCS-if-present + structural CRE.
- `ok` must **not** imply DON-authoritative CRE.
- If `hcs_seq` is absent, `hcs_confirmed` is `true` (vacuous) **or** expose `hcs_present: false` so UI can show HCS: SKIP. Prefer an extra `hcs_present: boolean` so SKIP ≠ confirmed.

Suggested extra fields:

```ts
hcs_present: row.json.hcs_seq !== undefined
```

UI: if `!hcs_present` show `HCS SKIP`, not `HCS OK`.

#### B3. Client types + Evidence Vault

Files:

- `apps/web/src/api.ts` — extend `VerifyPack` with `tiers?`, `ok_means?`, `cre_ok_means?`, `hcs_present?`
- `apps/web/src/CommandCenter.tsx` — `VerifyBanner` (around the HASH CHECK PASSED block)

Replace the single CRE OK chip with five chips:

| Chip | Source |
| --- | --- |
| HASHES | `tiers.recomputed` |
| SETTLEMENT | `tiers.settlement_confirmed` |
| HCS | SKIP if `!hcs_present`, else `tiers.hcs_confirmed` |
| CRE SIM | `tiers.cre_simulation` |
| CRE DON | always false until Phase C; label `DON —` |

Do not turn the whole banner green from `ok` alone if `cre_don_verified` is false. Keep `ok` for “receipt internally consistent + public rails.” Banner title can stay HASH CHECK PASSED when `ok`, with the DON chip grey.

Also show `external_settlement_verified` in the vault dl (HashScan link already exists via `settlement.ref`).

#### B4. OpenAPI

File: `openapi/openapi.yaml`

Document `GET /v1/evidence/{id}/verify` response: existing booleans + `tiers` object + `ok_means` + `cre_ok_means`. Note `cre_ok` is structural simulation, not DON.

#### B5. Evidence docs

File: `documentation/evidence.md`

0.0.66 already corrected Mirror Node wording and `cre_commitment_hash`. After B2, paste a real verify JSON example with `tiers`.

**Acceptance**

- Verify JSON has `tiers.*` without breaking old booleans.
- `/app` vault shows five chips; DON is never green.
- OpenAPI and evidence.md match.

**Do not** change join, settlement, or `ok` formula in this phase.

---

### Phase C — CRE honesty in the execution path

**Goal:** simulation remains the default; DON is a separate, proven rail.

**Already true**

- `simulateCreUnlocked` in `apps/api/src/join-run.ts` sets `cre.mode: "simulation"`.
- DON trigger (same file, `runJoin`) attaches `execution_id` and keeps simulation result. `mode` is not flipped to `"don"`.
- `GET /v1/meta` `posture.cre` is `"simulation"`. `cre.execution` is `simulation_ready` | `don_trigger_configured` | `unavailable`.

**Still to do**

1. **Forbid `mode: "don"` until a DON report is fetched and `cre_commitment_hash` matches.**
   - Search the repo for `mode: "don"` / `mode: 'don'`. Join-run should never write it from a trigger ACK.
   - If any caller copies `execution_id` into UI as LIVE DON, stop that (`CommandCenter` step 03 already keys off `cre.mode`).

2. **Meta enum (optional tightening)**
   File: `apps/api/src/routes/meta.ts`

   Today:

   ```ts
   execution:
     cfg.creWorkflowId && cfg.creEthPrivateKey
       ? "don_trigger_configured"
       : cfg.hopJoin === "cre" && creCli.ok
         ? "simulation_ready"
         : "unavailable"
   ```

   Add `"don_verified"` only when Phase C retrieve-and-match exists. Do not map “workflow id present” to verified.

3. **Optional retrieve-and-match (only if CRE gateway can return the report)**
   Files: `apps/api/src/cre-gateway.ts`, `apps/api/src/join-run.ts`, `cre/hop-query/main.ts`

   Sketch:

   ```ts
   // after triggerDeployedWorkflow
   const report = await fetchDonExecution(cfg, don.execution_id);
   if (report.commitment === cre.cre.cre_commitment_hash) {
     cre.cre.mode = "don";
     // then Phase B can set cre_don_verified true
   }
   ```

   If the gateway cannot return a comparable commitment, **do not fake it**. Leave retrieve as a documented follow-on. Ship C1+C2 without C3.

4. **Docs**
   File: `documentation/chainlink-cre.md`

   Replace leftover `report_hash` as the current field with `cre_commitment_hash`. State: simulate vs DON trigger vs DON-verified are three states. Vault secrets are production policy custody; local sim still injects `HOP_POLICY_TABLE_JSON` from the API process (`join-run.ts` spawn env). Do not claim exclusive TEE custody.

**Acceptance**

- No evidence pack has `cre.mode: "don"` unless a matched DON report exists.
- Infra card: DON trigger Configured ≠ DON result Verified (already labeled this way on `/app` after 0.0.66).
- chainlink-cre.md matches code.

**Do not** claim exclusive TEE custody. API still reads `HOP_POLICY_TABLE_JSON` to preflight before 402.

---

### Phase D — Charge semantics (document, then maybe code)

**Goal:** decide what a paid hop buys. Do not mix the two products.

Today (`apps/api/src/routes/query.ts`): after Blocky402 settle (~line 429), `runJoin`. Join throw → `status: "stale"` with settlement ref (~line 449). Caller paid for an attempt.

| Option | Behavior | Copy |
| --- | --- | --- |
| **D1 Charge for attempt** (current, recommended for testnet) | Always settle first. Stale is a paid receipt of failure. | “Paid request. Stale is a receipt.” |
| **D2 Charge for fresh decision** | Join before settle, or settle-and-credit on stale. | Only then can “one paid request → one fresh decision” be a guarantee. |

**Do D1 docs first (no refund engine):**

Files:

- `documentation/architecture.md` — charge table already says no refunds. Add one sentence on `/` CTA: landing is the product sentence, not a refund SLA.
- `openapi/openapi.yaml` — 200 `stale`: settled, join unevaluable.
- `skills/hop-query/SKILL.md` — agent must persist evidence id on stale; do not retry the same payment payload.
- Optional `/` CTA small print: keep the H2; do not add a narrative essay. A one-word control in CONTROLS is enough (`STALE` / `Charged receipt` is too much for landing). Prefer OpenAPI/SKILL.

**If you later choose D2 (after prize tape):**

1. Keep idempotency and concurrent claims from 0.0.59/0.0.62 (`durableClaim` in `query.ts` / store).
2. Options:
   - Join-before-settle: run CRE after `/verify`, settle only if `status !== stale`. Facilitator must allow verify-without-settle (Blocky402 already splits `/verify` and `/settle`).
   - Settle-and-credit: operator policy + a credit ledger. Do not silently refund HBAR on testnet without that policy.
3. Quote amount still meters by protocol count (`meter.ts`).

**Acceptance (D1 docs)**

- SKILL + OpenAPI say stale is charged.
- No new refund code.

---

### Phase E — Canonical receipt (additive schema)

**Goal:** one typed object agents persist. Do not rename `POST /v1/query` on the first cut.

**E1 (do this):** add `receipt` on the existing 200 body.

Files:

- `packages/shared/src/types.ts`
- `apps/api/src/routes/query.ts` (the `c.json({ status, aggregate, evidence, ...})` ~line 570)
- `openapi/openapi.yaml`
- `skills/hop-query/SKILL.md`
- `apps/mcp/src/index.ts` (hop_query output description)
- `apps/web/src/api.ts` + CommandCenter: show receipt id / schema in the verdict panel if present; do not hide `status` / `aggregate` / `evidence`

```ts
export type VerifiableDecisionReceipt = {
  schema: "hop.decision.v1";
  decision: {
    status: QueryStatus;
    query: QueryType;
    demo_vertical: "finance.lending_policy_gate";
  };
  privacy: {
    policy_values: "omitted";
    graph_source: "public";
    settlement: "public";
  };
  payment: {
    network: "hedera:testnet";
    scheme: "exact";
    ref: string;
    payer_account?: string;
    amount: string;
  };
  graph: Evidence["graph"];
  cre: Evidence["cre"];
  hashes: {
    aggregate: string;
    policy: string;
    peac?: string;
    chain?: string;
    cre_commitment?: string;
  };
  verification?: {
    tiers: VerificationTiers;
  };
  evidence_id: string;
};
```

Build it from the evidence pack already created in `query.ts` (do not duplicate join). `verification.tiers` can be omitted on the 200 if verify is a separate GET; agents call `/verify`. Prefer omitting live Mirror Node from the hot 200 path (latency). Document: `receipt.verification` is filled by `GET /v1/evidence/{id}/verify` or a later `?include=verify`.

**E2 (later, optional):** `POST /v1/decisions` alias of `/v1/query` that returns only the receipt. Same 402/settle. Do not split implementations.

Finance output stays sanitized aggregate + `accept|reject|stale|k_anon_denied`. Do not wrap as Prova suitability/KYC.

Optional later: `source_query_hash` / `source_response_hash` per Graph HTTP call inside CRE (`cre/hop-query/main.ts`). Not the API key, not raw rows.

**Acceptance**

- 200 still has `status`, `aggregate`, `evidence`.
- `receipt.schema === "hop.decision.v1"`.
- OpenAPI + SKILL describe the field.
- Existing MCP/UI keep working if they ignore `receipt`.

---

### Phase F — Tenancy (after prize tape)

**Goal:** evidence is attributable; policy is not a global singleton forever.

1. **Evidence list (product choice)**
   - Keep public `GET /v1/evidence` for the demo vault (current `listEvidence` in `apps/api/src/store.ts`), **or**
   - Add `?payer=0.0.x` and require a capability token for the unfiltered dump.
   - Default: keep the public list for the hackathon vault; add payer filter as additive.

2. **Policy refs (large; do not start during B–E)**
   - Today: singleton `HOP_POLICY_TABLE_JSON` (`config.ts` → CRE env in `join-run.ts`).
   - Next: `policy_ref` on the mandate / request; CRE `getSecret(policy_ref)`.
   - `policy.version` + `threshold_hash` already exist on evidence. Reuse them.
   - No policy editor UI until refs exist.

3. Do not build multi-tenant billing here.

---

### Phase G — Operator prize tape (manual; no new features)

Required before any “live product” screenshot:

1. Funded Hedera testnet payer + payee.
2. Graph Studio API key; both subgraphs healthy (`hasIndexingErrors` false).
3. CRE CLI auth (`cre whoami`); `POLICY_COMMITMENT_SALT`; Vault or sim env policy.
4. One settled `policy_check` with:
   - HashScan settlement
   - Graph subgraph ids + deployment ids + blocks
   - CRE simulation (not DON-verified)
   - optional HCS sequence
   - `GET /v1/evidence/{id}/verify` with `tiers.settlement_confirmed`
5. Capture that pack as the public proof.

---

### Phase H — Commercial (last)

Hosted API, SDK, SLA, API keys, billing — after the receipt is honest. Agent DX already has OpenAPI / MCP / SKILL / Agent Card. Do not add Stripe because Prova has Stripe.

---

## 3. File map

| Area | Files | Phase |
| --- | --- | --- |
| Public + product copy | `Landing.tsx`, `CommandCenter.tsx`, `Workbench.tsx`, README, SKILL, OpenAPI, MCP, Agent Card | A done |
| Verify tiers | `packages/shared/src/types.ts`, `apps/api/src/routes/evidence.ts`, `apps/web/src/api.ts`, `CommandCenter.tsx` VerifyBanner, `openapi/openapi.yaml`, `documentation/evidence.md` | B |
| CRE path | `apps/api/src/join-run.ts`, `cre-gateway.ts`, `cre/hop-query/main.ts`, `meta.ts`, `documentation/chainlink-cre.md` | C |
| Charge | `apps/api/src/routes/query.ts`, `x402.ts`, architecture.md, SKILL | D |
| Receipt | `types.ts`, `query.ts`, OpenAPI, SKILL, MCP, `api.ts` | E |
| Tenancy | `store.ts`, `config.ts`, CRE secrets | F |
| Changelog | `CHANGELOG.md` — bump `0.0.x` per phase | each |

---

## 4. Explicit non-goals

Do not implement unless a later review reopens them:

- Extra verticals (health, identity, generic “any policy”).
- Real KYC / World-as-compliance (World remains optional uniqueness).
- ATS / WALL as the public pitch (ATS stays at `/assets`).
- Harness-as-product.
- Graph Base USDC x402.
- New subgraph / custom indexing.
- Full Prova TDX / exclusive enclave custody theater.
- Bitcoin or extra anchors.
- Private payments (contradicts Hedera x402).
- Narrative essays on UI (labels, outcomes, steps only).

---

## 5. Defaults if you do not re-open product questions

| Question | Default |
| --- | --- |
| Public `GET /v1/evidence` list | Keep for demo vault; additive payer filter later |
| `ok` true on CRE simulation + public settlement | Yes. Separate `cre_don_verified` |
| Charge | D1 attempt. Document stale. |
| Receipt | E1 additive `receipt` on `/v1/query` |
| ATS | `/app` extra, not landing |

---

## 6. Suggested commit order

1. **B** — tiers + vault chips + OpenAPI. Small, makes the sentence on `/` true.
2. **C1/C2** — confirm no `mode: don` from trigger; docs. C3 only if gateway returns a matchable report.
3. **G** — operator live `policy_check` tape (human).
4. **D** — SKILL/OpenAPI charge-for-attempt wording.
5. **E** — `hop.decision.v1` additive field.
6. **F / H** — after the demo is true.

Acceptance for “ready to sell the sentence on `/`”:

- Landing and `/app` use the same privacy / settlement / Graph words. **(done 0.0.66)**
- Verify UI shows tiers; CRE DON is never green until matched.
- One public HashScan + evidence id for a paid `policy_check`.
- Docs match Mirror Node verify and `cre_commitment_hash`. **(docs done 0.0.66; tiers still Phase B)**

---

## 7. Related docs

- Architecture: `documentation/architecture.md`
- Payments: `documentation/hedera-x402.md`
- Data: `documentation/the-graph.md`
- CRE: `documentation/chainlink-cre.md`
- Agents: `documentation/agents.md`
- Evidence: `documentation/evidence.md`
