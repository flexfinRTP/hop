---
name: hop-query
description: Paid Hop decision query (sunset 0.1.0). Finance demo lending policy gate. Use for policy_check, market_params, position_counts, liquidations, or account_ltv over live Messari lending subgraphs. Settlement is public Hedera x402 exact (Blocky402). Policy values and Account.id are omitted from the result.
---

# Hop query

Sunset 0.1.0. Archive. Default API: `http://localhost:8787`. `GET /v1/meta` reports version 0.1.0 and status sunset.

Point an agent at this skill. It can pay Hedera exact x402 and call Hop in seconds. No SDK. No API key. No login.

Put this call **before** the tool that spends, binds, or actuates. Hop is the tool call before the tool call that cannot be undone. One 402-retry. Verdict ALLOW|HOLD|DENY|REVIEW. Attach `/verify/{id}` to the trace. Do not put Hop on every token.

HTTP contract: `openapi/openapi.yaml`. Why: `documentation/language.md`. Technical reference: `documentation/README.md`. Judge pack: `documentation/judge.md`. Default API: `http://localhost:8787`.

Hop is a deterministic resource server. Map the user request to a supported query type and to protocol keys from `hop_meta`. Do not send free text, SQL, or GraphQL. Do not invent sources.

## Constraints

- Client scheme: `@x402/hedera` `ExactHederaScheme`. Not Graph Base USDC x402.
- `extra.feePayer` from facilitator `GET {BLOCKY402}/supported`. Do not hardcode.
- `Idempotency-Key` required on the paid retry. Same key returns the same evidence id; no second settle.
- Mandate is optional (`mandate_json` or `HOP_MANDATE_JSON`). The model must not raise `max_tinybars` or sign payment.
- `confirm=true` only after HTTP 403 `mandate_review`.
- `world_token` from `POST /v1/world/verify` when `WORLD_REQUIRED=1`.
- `passport_token` from `POST /v1/identity/passports` when `HOP_PASSPORT_REQUIRED=1` (`X-Hop-Passport`).
- Optional `X-Hop-Did` / `X-Hop-Erc8004` stamp `receipt.identity` (syntax only). Not required to pay.
- Passport issue may include `did` and `erc8004` as the bound subject.
- Discovery: `GET /.well-known/did.json`, `GET /.well-known/oauth-protected-resource` (`oauth_on_query: false`).
- 403 bodies include `verdict` (`ALLOW`/`HOLD`/`DENY`/`REVIEW`) and `reason_code`. `mandate_review` also returns `consumer_prompt` and remaining budget.
- Paid 200 `receipt.decision.verdict` + `screening.ofac=not_screened`. Public verify: `/verify/{evidence_id}`.
- Stop on `503 cre_unavailable` / `graph_unconfigured` / `policy_unavailable`. Those are not paid.
- Paid 200 is charge-for-attempt. `stale` and `k_anon_denied` still settle. Persist `receipt.evidence_id`. Do not retry the same payment payload.

## Procedure

```ts
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";

const API = process.env.HOP_API_URL ?? "http://localhost:8787";

const meta = await fetch(`${API}/v1/meta`).then((r) => r.json());
const protocols = meta.protocols.filter((p) => p.configured).map((p) => p.key);
// choose one or two keys from that list; never invent ids

const body = {
  query: "policy_check", // or market_params | position_counts | liquidations | account_ltv
  protocols,
  max_block_lag: 50,
};

const unpaid = await fetch(`${API}/v1/query`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
if (unpaid.status === 503) throw new Error(await unpaid.text()); // do not pay
if (unpaid.status !== 402) throw new Error(`unexpected ${unpaid.status}`);

const { accepts } = await unpaid.json();
const requirements = accepts[0];
// requirements.scheme === "exact"
// requirements.network === "hedera:testnet"
// requirements.asset === "0.0.0" unless HTS

const signer = createClientHederaSigner({
  accountId: process.env.HEDERA_PAYER_ID!,
  privateKey: PrivateKey.fromString(process.env.HEDERA_PAYER_KEY!),
});
const payload = await new ExactHederaScheme(signer).createPaymentPayload(2, requirements);

const paid = await fetch(`${API}/v1/query`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-PAYMENT": Buffer.from(JSON.stringify(payload)).toString("base64"),
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify(body),
});
const result = await paid.json();
// result.receipt.schema === "hop.decision.v1"
// result.receipt.decision.verdict === "ALLOW" | "HOLD" | "DENY"
// result.receipt.verify_path === "/verify/{id}"
// result.receipt.evidence_id is the public pack id
// result.status stale | k_anon_denied is still charged (attempt). Persist the receipt. Do not reuse X-PAYMENT.
// hop_evidence / hop_peac / hop_verify with result.receipt.evidence_id
// hop_verify returns tiers; cre_don_verified is true only after a matched DON result
```

MCP: `hop_meta`, `hop_mandate`, `hop_query`, `hop_pay`, `hop_evidence`, `hop_peac`, `hop_verify`, `hop_passport_issue`, `hop_passport_get`, `hop_passport_bind`, `hop_passport_revoke`, `hop_world_rp_context`, `hop_world_verify` (`npm start -w @hop/mcp`). Discovery: `GET /.well-known/agent-card.json`, `GET /.well-known/did.json`. `GET /v1/meta` includes `standards` and `hitl`.
