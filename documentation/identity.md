# Identity

**Sunset 0.1.0.** Archive.

Hop passports are the identity control plane for agents. They are not KYC, not World ID, and not a replacement for W3C DID or ERC-8004.

Enterprise: L3 binds who may hop. Default remains autonomous. Optional DID stamps the receipt — not required to pay. Agent workflow: passport is a header, not a login wall. Why: [`language.md`](language.md).

A passport is a MAC-signed token (`h1.<payload>.<mac>`) bound to `agent_id`, query capabilities, expiry, and an optional mandate `policy_root`. Optional `did` and `erc8004` on the passport (or `X-Hop-Did` / `X-Hop-Erc8004` on the hop) stamp the receipt. They are **not required to pay**. Public `POST /v1/query` stays x402-only.

The API checks the token against the durable store (file and, when configured, Postgres). Revoked or expired tokens fail closed. DID is syntax-checked only (no remote resolve on the paid path). ERC-8004 is a registry pointer, not a live on-chain lookup.

## HTTP

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/v1/identity/passports` | Issued passports (no tokens) |
| `POST` | `/v1/identity/passports` | Issue `{ passport, token }` |
| `GET` | `/v1/identity/passports/{id}` | Public passport record |
| `POST` | `/v1/identity/passports/{id}/bind` | Bind mandate hash; new token |
| `POST` | `/v1/identity/passports/{id}/revoke` | Revoke |

`POST /v1/query` accepts `X-Hop-Passport`. `HOP_PASSPORT_REQUIRED=1` rejects paid hops without a valid token **before settle**. `HOP_PASSPORT_SECRET` is required to issue or verify. Empty secret → `503 identity_unconfigured` on identity routes; queries without a passport header still run.

## Mandate assurance (TAP pattern)

Mandates carry `assurance`:

| `kind` | `level` | Gate |
| --- | --- | --- |
| `operator` | L1 | Spend cap only |
| `human_threshold` | L2 | `mandate_review` until `X-Hop-Confirm: 1` |
| `passport_bound` | L3 | Valid passport + matching `agent_id` + `policy_root` |

This is the Visa TAP **delegation shape** (limits, prompt, bound identity) on Hedera x402. It is not a Visa or Stripe integration.

## Receipt

Paid `hop.decision.v1` includes `identity` when a passport, DID, or ERC-8004 pointer was presented, plus `screening.ofac = not_screened`.

Mismatch with a bound passport fails closed **before settle**: `did_mismatch` / `erc8004_mismatch`. Bad DID syntax is `did_invalid`. Bad ERC-8004 pointer is `erc8004_invalid`.

## Discovery (enterprise)

| Path | Standard |
| --- | --- |
| `GET /.well-known/did.json` | W3C `did:web` for this origin |
| `GET /.well-known/agent-card.json` | A2A 0.2.9 (`securitySchemes.x402`) |
| `GET /.well-known/agent-registration.json` | ERC-8004 registration-v1 |
| `GET /.well-known/oauth-protected-resource` | RFC 9728. `oauth_on_query: false` |
| `GET /v1/meta` | `standards` + `hitl` flags |

Human-in-the-loop is **not** every hop. `hitl.default = autonomous`. L2 = `X-Hop-Confirm` after `mandate_review`. World ID = optional uniqueness (`X-Hop-World`), not login.

Caller headers (all optional except payment on the paid retry):

| Header | Role |
| --- | --- |
| `X-PAYMENT` | x402 exact (required to settle) |
| `X-Hop-Passport` | Hop capability ticket |
| `X-Hop-Did` | Audit identifier |
| `X-Hop-Erc8004` | ERC-8004 agentId;registry |
| `X-Hop-Confirm` | L2 human confirm |
| `X-Hop-World` | Unique-human session |
