# Judge pack

**Sunset 0.1.0.** Score what is on tape. Extra tracks are extra. ETHOnline 2026 archive.

## Open these

| Surface | URL |
| --- | --- |
| Product | `/` |
| Decision room | `/app` |
| Public receipt | `/verify/{id}` after a paid hop |
| Pitch | `/pitch.html` |
| Agent docs | `/docs` |
| This page | `/docs/judge` |
| OpenAPI | `/openapi.yaml` · `/swagger.html` |
| Skill | `/SKILL.md` |
| Machine map | `/llms.txt` |
| A2A card | `/.well-known/agent-card.json` |
| DID | `/.well-known/did.json` |
| RFC 9728 | `/.well-known/oauth-protected-resource` |
| ERC-8004 meta | `/.well-known/agent-registration.json` |
| Meta | `GET /v1/meta` → `standards`, `hitl`, `rails` |

Do not score `/assets` or Sepolia unless the operator ran those tracks.

## Why (talk track, not a score)

- Enterprise: uninsured process without a receipt. Audit gets `/verify/{id}`.
- Agent: tool call before the irreversible tool call. Unpaid 402. No API key.

Language lock: [`language.md`](language.md). Do not score TAM.

## Scoreable claims

| Claim | Proof |
| --- | --- |
| No API key | Unpaid `POST /v1/query` → **402** |
| Hedera exact x402 | Receipt `payment.rail = hedera_x402_exact` · HashScan |
| Private policy | Caps omitted from 200 and evidence |
| Public Graph | Messari 3.1.0 · Aave + Compound subgraph ids on the pack |
| CRE join | `HOP_JOIN=cre` · CRE SIM chip. DON is `—` unless matched |
| Charge-for-attempt | `stale` / `k_anon_denied` still 200 settled |
| Fail closed | 503 before settle if CRE/Graph/policy missing |
| Verdict vocab | `ALLOW` / `HOLD` / `DENY` / `REVIEW` + `reason_code` |
| Honest screening | `ofac: not_screened` · `kyc: not_performed` |
| Public verify | Copy `/verify/{id}` |
| Optional identity | Passport / `X-Hop-Did` / `X-Hop-Erc8004` stamp receipt. Not required to pay |
| HITL is a gate | Default autonomous. L2 = `X-Hop-Confirm`. World = uniqueness, not login |
| Public HTTP is x402 | RFC 9728 `oauth_on_query: false` |

## Not claimed

- Hardware TEE on CLI simulate
- OFAC / KYC / Chainalysis
- Graph Base USDC x402
- Visa TAP network or Stripe
- DID resolver on the paid path (syntax only)
- Live ERC-8004 mint required
- MCP HTTP OAuth on `/v1/query`
- Private payments

## 3-minute tape

1. `/app` · `policy_check` · Aave + Compound · unpaid 402.
2. Pay. AGENT BUDGET remaining drops. Verdict `ALLOW` or `HOLD`.
3. VERIFY HASHES: HASHES / SETTLEMENT / CRE SIM. HCS SKIP unless seq. DON `—`.
4. VERIFY LINK → `/verify/{id}`. HashScan.
5. Optional: `X-Hop-Did` or ISSUE passport. Receipt `identity` set.

Talk track: [`demo-script.md`](demo-script.md). Operator: [`operator.md`](operator.md).

## Standards (enterprise, no login wall)

| Standard | Hop |
| --- | --- |
| x402 v2 | Hedera `exact` · Blocky402 |
| A2A 0.2.9 | Agent Card · `securitySchemes.x402` |
| MCP 2025-06-18 | stdio tools. Not OAuth on query |
| W3C DID | `did:web` document + optional caller DID |
| ERC-8004 | registration-v1 metadata + optional pointer |
| RFC 9728 | Advertises query is **not** OAuth |
| TAP shape | Mandate L1 / L2 / L3 |
| World ID | Optional uniqueness |
| PEAC | Shaped export, not a registry |

`GET /v1/meta` `standards` is the machine index.

## Shipped (score this, not the extra tracks)

| Version | On tape |
| --- | --- |
| 0.0.78 | Verdicts `ALLOW`/`HOLD`/`DENY`/`REVIEW`. Honest screening. `/verify/{id}`. Hop passports. Mandate L1–L3. |
| 0.0.79 | Pitch visual rewrite. Judge-facing labels. |
| 0.0.80 | Optional DID / ERC-8004. `did.json`. RFC 9728 `oauth_on_query: false`. Agent Card `securitySchemes.x402`. Meta `standards` + `hitl`. |
| 0.0.81 | This pack + marketing/docs alignment. |
| 0.0.82 | Pitch rewrite: Pay → Decide → Verify; Hedera / x402 / CRE / Graph layouts. |
| **0.1.0** | Sunset tag. OpenAPI / Agent Card / `GET /v1/meta` version **0.1.0**. `status: sunset`. Hosted Vercel, cream site, pitch, docs hub through 0.0.107. |

Talk track: [`demo-script.md`](demo-script.md). Operator: [`operator.md`](operator.md). Identity: [`identity.md`](identity.md).
