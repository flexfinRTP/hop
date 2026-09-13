# Changelog

Versions increment by `0.0.x` per feature. No dates.

## Roadmap

Code complete through **0.0.76**. Public product is **verifiable decision infrastructure for agents** (finance lending policy gate as the demo vertical). Agent DX: `/docs` hub with rendered SKILL/llms + hosted Swagger; agents still fetch `/llms.txt`, `/openapi.yaml`, `/SKILL.md`. Remaining work is operator tape ([`documentation/operator.md`](documentation/operator.md)): CRE login, restart API, one paid hop, optional ATS + Sepolia.

Operator activation still requires funded testnet accounts, live Graph/CRE credentials, one paid hop on tape, and (for extra tracks) an ATS wallet lifecycle plus Sepolia `join()`. See [`documentation/README.md`](documentation/README.md).

Local test bootstrap is **0.0.19** (`npm run setup:local`). Still needs you: Hedera faucet + Graph Studio API key.

## 0.0.76

### Removed

- `/app` Decision room: `FINANCE DEMO` eyebrow.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.75

### Changed

- `/app` muted labels use darker sage so gray text stays readable on cream.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.74

### Changed

- `/app`: removed breadcrumb topbar and CONFIG LOADED. Testnet label sits in the page head. Charcoal stat strip is cream panel. Less top padding.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.73

### Removed

- Public `/desk` bunny night-desk page and its nav links. Old `/desk` URLs go to `/app`. Decision room at `/app` is unchanged.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.72

### Changed

- `/` proof stack uses downloaded official marks: The Graph GRT, Chainlink hex, Hedera H.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.71

### Added

- `/` proof stack (“Every rail has one job.”): Graph, Chainlink, and Hedera marks on each rail.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.70

### Added

- `/docs` marketing docs hub with sidebar, file cards, Swagger, and rendered articles. SKILL and llms.txt have human pages (`/docs/skill`, `/docs/llms`); agents still fetch `/SKILL.md` and `/llms.txt`.
- Dedicated `docs.css` so launch palette edits cannot drop the docs layout.

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.69

### Changed

- `/app` decision room uses the marketing palette: cream ground (`#f3ede0`), eucalyptus (`#4c7a6b`), terracotta live accent (`#c96b4a`). CSS tokens and hardcoded ops colors only; no layout or TSX changes.

### Next

- Optional: match `/assets` and `/desk` to the same palette after `/app` preview.

## 0.0.68

### Changed

- `/` marketing page: cream ground (`#f3ede0`), eucalyptus secondary (`#4c7a6b`), terracotta accent (`#c96b4a`). `/app`, `/desk`, and `/assets` keep the previous dark mint palette until approved.

### Next

- Apply the cream / sage / terracotta palette to `/app` after marketing preview.

## 0.0.67

### Added

- `GET /v1/evidence/{id}/verify` returns `tiers` (recomputed, settlement, HCS, CRE sim, CRE DON), `ok_means`, `cre_ok_means`, `hcs_present`. `cre_don_verified` is always false until a matched DON result exists.
- `/app` vault chips: HASHES / SETTLEMENT / HCS / CRE SIM / DON —. DON is never green. HCS shows SKIP when no sequence.
- Operator activation: [`documentation/operator.md`](documentation/operator.md).

### Next

- You: `cre login`, restart API, one paid `/app` hop, video. ATS and Sepolia are extra.

## 0.0.66

### Changed

- `/` and `/app` copy: verifiable decision infrastructure for agents. Private policy / public settlement / verifiable evidence. Finance is the demo vertical, not the market.
- `/app` pipeline: CRE confidential workflow (SIM unless `cre.mode` is don); standardized Graph join; HCS labeled optional until `hcs_seq` exists.
- Desk labels: CRE check / policy values omitted. Kept desk layout and “Private rules. Clear decisions. Built for agents.”
- README, docs index, OpenAPI, SKILL, MCP, Agent Card: decision infrastructure wording. Settlement remains public Hedera x402. Policy values omitted.
- Evidence docs: Mirror Node verify, `cre_commitment_hash`, `ok` does not mean DON-verified.
- Implementation plan is now the executable remaining-work spec (Phases B–H).

### Next

- Phase B: verification tiers on `GET /v1/evidence/{id}/verify` and `/app` vault chips (HASHES / SETTLEMENT / HCS / CRE SIM / CRE DON).
- Operator: one paid CRE `policy_check` on HashScan.

## 0.0.65

### Changed

- Intended `/` launch copy for verifiable decision infrastructure. Source landing was still the prior pitch until 0.0.66 applied it.

### Added

- First implementation plan: [`documentation/product-implementation-plan.md`](documentation/product-implementation-plan.md). No API or `/app` code in this version.

## 0.0.64

### Added

- Official ATS v8 testnet factory `0.0.9213391`, resolver `0.0.9212226`, and bond config id as defaults. Browser client resolves `configVersion` via `Management.resolveLatestConfigVersion`.
- Full ATS follow-on actions on a verified parent: coupon, pause, unpause, `Bond.fullRedeemAtMaturity`. Optional internal KYC uses a caller-supplied Base64 VC (no fabricated credential).
- Mirror ATS verifier and harness now retry 404s, require factory `created_contract_ids`, and record contract logs.
- `/app` infrastructure shows live ATS intent counts and official Sepolia ChallengeLending status. The old simulated WALL view is removed.
- API file-store boot no longer requires `pg` to be loaded. Postgres still activates when `DATABASE_URL` is set.

### Next

- Operator: one paid CRE `policy_check`, one wallet-signed ATS lifecycle on HashScan, one Sepolia `join()` + `cre workflow simulate liquidation-protection`.

## 0.0.63

### Added

- `/v1/assets` intent, ATS configuration, transaction submission, Mirror Node verification, evidence linkage, and HCS lifecycle anchoring.
- `/assets` browser-wallet workspace using `@hashgraph/asset-tokenization-sdk` 8.0.0 for bond creation, multi-role assignment, allowlist controls, issuance, transfer-and-lock, and optional coupon creation.
- `@hop/hedera-lifecycle-harness`: declarative YAML/JSON verification for Hedera transfers, contract results, HCS messages, and mandatory ATS lifecycle stages.
- PostgreSQL and file persistence for ATS intents.

### Safety

- ATS mutations require explicit browser-wallet approval; the API never holds an ATS wallet key.
- Asset intent creation requires an accepted Hop decision and externally verified Hedera x402 settlement.
- UI and evidence label the instrument as testnet-only with no investment rights.

## 0.0.62

### Added

- Optional PostgreSQL evidence and request-claim store with migrations, unique idempotency/payment constraints, settlement states, HCS outbox, and file-mode fallback.
- Hedera Mirror Node verification for payer, payee, exact amount, transaction result, HCS topic, sequence, and anchored payload.
- Autonomous `hop_pay` MCP buyer with local-only payer key custody, quote/mandate validation, exact Hedera signing, idempotent retry, and evidence verification.
- Agent0 standardized Subgraph discovery routes, ERC-8004 registration metadata, and an official Subgraph MCP + Hop MCP Cursor configuration example.
- CRE authenticated readiness gate using `cre whoami`.

### Corrected

- Graph evidence now stores the immutable `_meta.deployment` separately from the logical Subgraph ID and fails closed on `_meta.hasIndexingErrors`.
- Confidential policy commitments can use a TEE-only commitment salt; CRE requires `POLICY_COMMITMENT_SALT`.
- CRE evidence uses `cre_commitment_hash`; raw CLI tails are no longer persisted as artifacts.
- Concurrent mandate rollback releases its named reservation instead of whichever hop was appended last.
- HCS anchors retain their topic ID and failed submissions enter a durable retry outbox.
- Demo signing is disabled whenever `NODE_ENV=production`.

## 0.0.61

### Added

- Public technical reference under `documentation/` (architecture, Hedera x402, standardized Graph, CRE, agents, evidence). README, `llms.txt`, SKILL, and OpenAPI point at it.
- `GET /.well-known/agent-card.json` A2A Agent Card (discovery). Vite proxies `/.well-known` to the API.
- Messari `InterestRate` (`side`, `type`, `rate`) on `HopMarkets`; `market_params` returns `borrow_variable_rate`.
- Graph `_meta.deployment` and `hasIndexingErrors` on the protocol query. Evidence stores `subgraphId` (Gateway id) and `deploymentId` (`_meta.deployment`).
- `/v1/meta` exposes `mcp_tools`, `agent_card`, and `documentation`. Infrastructure view shows protocol-count meter and Agent Card path.

### Changed

- OpenAPI `0.0.61`. Graph deployment objects require `subgraphId`.
- Agent skill includes a complete Hedera exact 402 retry example.

### Removed

- Root `PRIZES.md`. Integration and operator material lives in `documentation/`.

## 0.0.60

### Added

- Prize-track mapping draft (replaced in 0.0.61 by `documentation/`).

### Next

- Operator: one settled `policy_check` with live Graph provenance, CRE simulation artifact, HashScan, and HCS.

## 0.0.59

### Corrected

- CRE now scopes Graph calls to exactly the requested protocols and returns a SHA-256 commitment hash instead of mislabeled base64 payload bytes.
- Shared canonical hashing now uses a runtime-portable synchronous SHA-256 implementation, removing the Node crypto dependency from CRE WASM compilation.
- A configured DON trigger no longer relabels a local simulation result as a DON result; execution IDs remain attached without overstating provenance.
- API-triggered CRE simulations are serialized and use an ignored generated config target, avoiding concurrent request cross-contamination and tracked runtime-config rewrites.
- Selected Graph sources are all required. Partial protocol success, indexing errors, missing chain head, missing deployment blocks, or unevaluable policy metrics now fail closed as `stale`.
- Liquidation pagination now uses the actual 200-row page size.
- Graph evidence now distinguishes `subgraphId` and records Messari `methodologyVersion` plus `_meta.block.timestamp`.
- Aggregate sanitization recursively removes policy, threshold, metric, account, and address-bearing fields.
- Concurrent requests now claim both idempotency keys and payment payloads before settlement, preventing duplicate in-flight settlement in one API process.
- Demo signing only accepts an exact, short-lived requirement previously issued by this API.
- `WORLD_REQUIRED=1` with incomplete World configuration now fails before payment.
- Evidence verification now recomputes aggregate, chain link, predecessor, PEAC, and CRE commitment checks. CRE validity participates in overall `ok`; external settlement/HCS verification remains explicitly false.
- PEAC hashes are generated after optional HCS sequence assignment.
- `/app` and `/desk` require explicit approval before using the server demo signer.
- UI and health metadata distinguish configured rails, simulations, and DON triggers from verified live dependency health or DON results.
- `/app` VERIFY HASHES reports on the button and a visible hash-check banner after a run. The previous result sat below the fold, so the control looked inert.

### Changed

- API-run CRE uses the new `api-settings` target and `config.runtime.generated.json`; manual `staging-settings` remains unchanged.
- OpenAPI version is `0.0.59` with payment headers, concurrency response, World configuration error, and accurate CRE commitment semantics.
- README documents the simulator launcher’s policy visibility and the boundary between DON trigger acceptance and verified DON output.

## 0.0.58

### Added

- `/app`: enterprise decision gateway with Decision Room, Evidence Vault, and Infrastructure views.
- Decision Room: live five-stage mandate/payment/private-compute/data/evidence pipeline driven by real trace and receipt state.
- Evidence Vault: recent persisted decisions, evidence inspection, PEAC export, hash verification, Graph deployment proof, and HashScan links.
- API: `GET /v1/evidence?limit=50` for newest-first public evidence packs.
- `/`: focused launch interface for the confidential autonomous-capital risk gateway.

### Changed

- Narrowed the primary UI from generic prompt patterns to the real lending-risk product: a private utilization policy across Aave v3 and Compound v3.
- Made The Graph standardization, Chainlink `handlerInTee`, Hedera Blocky402 settlement, mandates, and HCS evidence visible as distinct proof stages.
- Preserved the original night desk at `/desk`, all supported query types, manual `X-PAYMENT`, World ID, voice controls, WALL, MCP, SKILL, and receipt exports.
- OpenAPI version is now `0.0.58` and documents the evidence collection route.

### Verified

- Production builds complete for `@hop/web` and `@hop/api`.

## 0.0.55

### Changed

- `/`: slightly reduced the marketing hero title size on desktop and mobile.

### Done (MVP engine + desk)

- [x] 0.0.9 Schema-true Messari join (five query types, k-anon bins, caps hashed)
- [x] 0.0.10 CRE `handlerInTee` live Graph + policy (`cre workflow simulate`)
- [x] 0.0.11 Blocky402 charge table, idempotency, evidence GET
- [x] 0.0.12 Night-desk workbench, chips, rail, traces, WALL screen
- [x] 0.0.13 Payment replay, timeouts, CORS, Graph URL only with key
- [x] 0.0.14 Evidence disk + TTL, optional HCS hash
- [x] 0.0.15 MCP + SKILL
- [x] 0.0.16 Meta + SSE + X-PAYMENT on the workbench
- [x] 0.0.17 Default house limit = both books utilization `gt 0.78` (`scope: all`)
- [x] 0.0.18 Phase D roadmap (complete vs remaining vs 20 docs)
- [x] 0.0.19 Local bootstrap: generate Hedera keys into `.env`, readiness check scripts
- [x] 0.0.20 Workbench: browser-safe `@hop/shared/ui` (white screen was `node:crypto`)
- [x] 0.0.21 `policy_check` join: protocol totals only (no 1000-market/liq pull after pay)
- [x] 0.0.22 Join: IPv4-first fetch, RPC fallback, Graph errors do not wipe a paid hop
- [x] 0.0.22 Desk POV workbench: cinematic plates, rain, full-size bunny + wheel, OLED screen
- [x] 0.0.23 Desk composite: UI on laptop screen, in-scene bunny/wheel, window rain only
- [x] 0.0.24 Desk overlay plates keyed to alpha; rain + wheel motion aligned to the plate
- [x] 0.0.25 Workbench: industry asks + stamp first; query/protocols under agent; 402 never Evidence; HashScan
- [x] 0.0.26 Empty desk plate; bunny+wheel as one alpha prop; disc-only spin
- [x] 0.0.27 Marketing site at `/` (Increase paper layout); `/app` check; desk at `/desk`
- [x] 0.0.28 `/app` console (stamp, live trace, evidence). Paper stays on `/` only
- [x] 0.0.29 `/app` cream + bright red (layout kept; dark theme dropped)
- [x] 0.0.30 `/app` red cut with cream/ink mix (readable accents)
- [x] 0.0.35 Mandate + PEAC + HCS auto + metered 402 + evidence chain + MCP agents + posture labels
- [x] 0.0.36 CRE HTTP `handlerInTee` + Nitro + DON report hashes; egress allowlist; live HCS commitments; World ID 4.0 uniqueness; no CRE→inline fallback
- [x] 0.0.37 `/app` + desk: flow line above the ask box; info icons on check, chips, rails, stamp, evidence
- [x] 0.0.38 `/`: tell your agent → llms.txt + OpenAPI/Swagger + SKILL + README
- [x] 0.0.39 `/`: buyer-first marketing narrative, animated desk visual, use cases, judge proof rails
- [x] 0.0.40 `/`: colorful Hop mascot hero and three additional plain-English prompt cards
- [x] 0.0.41 `/`: replace toy mascot with angular screen-printed AI-agent infrastructure mascot
- [x] 0.0.42 `/`: replace animal mascot direction with an abstract hopping agent-router machine
- [x] 0.0.43 `/`: replace extra prompt patterns with manufacturing, agriculture, and logistics
- [x] 0.0.44 `/` + `/app`: approved tagline and paid/private/verifiable positioning
- [x] 0.0.45 `/app`: plain-language controls, friendly statuses, lighter help tips, cleaner labels
- [x] 0.0.46 `/`: original hand-drawn HOP bunny mascot replaces the agent-router hero art
- [x] 0.0.47 `/`: simplify bunny art to plain scarf and clean motion strokes
- [x] 0.0.48 `/app`: question-first layout, visible payment step, large answer state, collapsed activity/receipt
- [x] 0.0.49 `/app`: calmer product UI, click-only help, fewer icons, readable activity/receipt labels, and clearer typography
- [x] 0.0.50 `/app`: preserve Activity as the raw technical trace with original rails and log messages
- [x] 0.0.51 `/app`: replace the prompt selector with question cards and give decisions a dedicated output display
- [x] 0.0.52 `/app`: add live source refresh/status, clearer loading and failure states, and cleaner receipt/settings actions
- [x] 0.0.53 `/app`: expand technical Activity during checks, collapse it on completion, and open Receipt for completed results
- [x] 0.0.54 `/app`: add live runtime timing and a four-stage ASK/PAY/CHECK/PROVE progress meter
- [x] 0.0.55 `/app` + API + agent docs: expose supported check/source selection, reject unconfigured sources before payment, and document that Hop does not parse free text
- [x] 0.0.56 API + `/app`: configure CRE CLI paths, preflight CRE before payment, expose runner readiness, and return `503 cre_unavailable` instead of charging for stale output
- [x] 0.0.57 Local setup: install official CRE CLI v1.33.0, add its user PATH entry, and configure the API with its absolute Windows executable path

### Phase D — Chainlink Best Confidential Workflow (Classic; $2k / 2×$1k)

Qualify: `handlerInTee` HTTP + `POLICY_TABLE` in TEE + live Graph join + `usingTheDons().report()`. Skip Upgrade (Continuity). Skip official liquidation/audit/rebalance templates and past CRE winners (Ghost, Aegis KYC, Risk Router, ENShell, Kondor).

- [x] 0.0.36 Nitro `us-west-2`; HTTP trigger; `usingTheDons().report()` hashes + stamp; no enclave logs
- [x] 0.0.36 Egress allowlist: caps / Account.id never leave; metric hashed; `HOP_JOIN=cre` has no silent inline fallback
- [x] 0.0.36 Evidence CRE artifact + optional live DON `CRE_WORKFLOW_ID`; HCS commitments include policy/CRE/world hashes
- [x] 0.0.36 World ID 4.0 Cloud verify (optional / `WORLD_REQUIRED`)
- [ ] Prize tape: `cre workflow simulate` TEE banner + one paid Blocky402 hop + HashScan

### Phase D — owner prize take (not more product)

- [ ] Fund the two EVM addresses in `data/local-wallets.public.json` at the Hedera testnet faucet, then `npm run setup:accounts`
- [ ] Paste `GRAPH_API_KEY` from https://thegraph.com/studio/apikeys/ into `.env` and `cre/.env`
- [ ] Live `.env` already has demo signer on (`HOP_DEMO_SIGN=1`) after `setup:local`
- [ ] One real Blocky402 paid `POST /v1/query` (HashScan in README)
- [ ] Prize take `HOP_JOIN=cre` + `cre workflow simulate` logs in the video
- [ ] `PAYER_ALLOWLIST` set by `setup:accounts` to the demo payer
- [ ] ETHGlobal video 2–4 min, ≥720p, no TTS, no phone; Hedera extra ≤5 min paid clip
- [ ] Submit Graph + Hedera + Chainlink. Public `AI.md`. Sunday Sep 13, 12:00 pm EDT

### Phase D — small code if the tape still needs it

- [x] UI: Graph `503` is not labeled `policy_unavailable`
- [x] OpenAPI: `/v1/meta` body, extra error codes, version bump
- [x] Mandate/budget wrapper (deterministic; LLM never pays)
- [x] PEAC-shaped export + evidence hash chain + `/verify`
- [x] HCS auto-topic on first paid hop (`HOP_HCS_AUTO=1`)
- [x] Metered 402 from public protocol count
- [x] MCP: `hop_mandate` / `hop_peac` / `hop_verify` / `hop_meta`
- [x] Public `AI.md` + HashScan example in README

### After submit (commercial)

- [ ] Hosted Hop + tenant policy + accepted-decision metrics
- [ ] WALL only with a regulated execute partner

Owner go: `npm install`, fill `.env`, `npm run dev:api`, `npm run dev:web`. Do not start REPO/POOL/ATS/Arduino/combo desk.

## 0.0.48

### Changed

- `/app` now prioritizes the question and answer, with a clear run/approve payment action.
- Activity and Receipt stay compact until needed; the Activity panel no longer consumes the empty half of the screen by default.
- Added plain-language idle/checking states, payment explanation, and a readable progress path.
- Kept advanced agent settings and detailed traces available without putting them in the primary workflow.

## 0.0.47

### Changed

- Removed circuit lines, network nodes, and technical patterns from the bunny art. The hero now uses a clean hand-drawn bunny with a plain red scarf, amber button, and simple motion strokes.

## 0.0.46

### Changed

- Replaced the abstract machine hero with an original hand-drawn storybook HOP bunny featuring a red signal scarf, teal data details, and animated movement.

## 0.0.45

### Changed

- `/app` default view now uses Question, Answer, Settings, Activity, Receipt, Run check, and Payment record.
- Replaced raw status codes and developer labels with plain-language messages.
- Shortened info tips and changed app tooltips from black panels to light, readable cards.
- Kept technical controls available under Settings while reducing default-screen noise.

## 0.0.44

### Added

- Marketing hero tagline: `Private rules. Clear decisions. Built for agents.`
- Marketing and app positioning line: `Paid, private, verifiable agent decisions.`

## 0.0.43

### Changed

- Replaced the finance/software-adjacent prompt examples with physical-world industries: manufacturing defects, agricultural irrigation, and shipment delivery windows.

## 0.0.42

### Changed

- Replaced the animal mascot direction with a non-animal agent-router machine: modular server body, spring-loaded hop motion, antenna, ports, routing arrows, and HOP infrastructure palette.

## 0.0.41

### Changed

- Replaced the generic 3D bunny with an angular editorial/screen-print mascot: a rabbit-shaped agent router with data-rail ears, routing blocks, and HOP infrastructure labeling.
- Updated the hero status badge from a policy result to `HOP / AGENT INFRA` and `ROUTE READY`.

## 0.0.40

### Added

- Replaced the desk preview hero with a generated Hop mascot: expressive bunny, oversized signal ears, branded red/teal/amber palette, and animated status badge.
- Added Treasury, Credit, and Operations prompt cards with simple business language.
- Marked extra prompts as patterns and kept the current Graph lending demo boundary explicit.

## 0.0.39

### Added

- Rebuilt the marketing page around clear business outcomes: private rule, paid check, clear stamp, verifiable receipt.
- Added a responsive hero visual using the existing night-desk artwork, with a CSS-animated Hop check screen, scan line, live indicator, and signal beacons.
- Added judge-facing proof sections for The Graph, Chainlink CRE, Hedera x402, World ID, mandate, PEAC, and agent docs.

## 0.0.38

### Added

- `/` Tell your agent: llms.txt, OpenAPI, Swagger editor, SKILL, README. Same-origin files for agent fetch. Mandate / PEAC / posture stay under that block.

## 0.0.37

### Added

- `/app` and `/desk`: short flow above the ask box (`query dataset privately → pay a tiny fee → stamp over / not over`).
- Info icons on the main actions (ask, chips, check, stamp, rails, agent, evidence, PEAC, verify). One-line layman tips. No essays.

## 0.0.36

### Added

- CRE workflow is HTTP `handlerInTee` constrained to Nitro `us-west-2`. Policy secret + live Graph join stay in the enclave. `usingTheDons().report()` commits hashes + stamp only. No enclave logs.
- Paid hop with `HOP_JOIN=cre` (default) runs `cre workflow simulate --http-payload` (live Graph/RPC inside WASM). No silent inline fallback. Optional `CRE_WORKFLOW_ID` POSTs `workflows.execute` to the CRE gateway.
- Egress allowlist: cap values and Account.id never leave; `policy_check` returns `metric_hash` + public `observed`.
- HCS message includes policy / CRE report / World nullifier hashes. Evidence `cre.tee`, `cre.trigger`, `cre.report_hash`.
- World ID 4.0: `/v1/world/rp-context`, `/v1/world/verify` (developer.world.org v4), `X-Hop-World` session token. Nullifier stored as SHA-256 only. Not KYC.

### Changed

- Default join is CRE. `HOP_JOIN=inline` remains for local join without the CRE CLI.
- OpenAPI 0.0.36: World routes, CRE report fields, `world_required`.

## 0.0.35

### Added

- Agent mandate: budget, velocity, expiry, merchant bind, query allowlist, HITL threshold. `X-Hop-Mandate` / `X-Hop-Confirm`. Atomic reserve before settle. LLM never pays.
- PEAC-shaped receipt `GET /v1/evidence/{id}/peac` plus `GET /v1/evidence/{id}/verify`.
- Evidence hash chain (`prev` + `hash`) and HCS message includes mandate/chain hashes. `HOP_HCS_AUTO=1` creates a testnet topic on first paid hop.
- Metered 402: base tinybars + extra per extra protocol (public count). Optional cached utilization scale. Never the secret cap.
- MCP tools: `hop_mandate`, `hop_peac`, `hop_verify`, `hop_meta`. SKILL retry includes mandate.
- `/` Agent row (mandate / PEAC / posture). `/app` remaining budget, PEAC export, verify.
- Public `AI.md`. README HashScan example.

### Corrected

- Workbench 503 maps `graph_unconfigured` / facilitator / merchant separately from `policy_unavailable`.
- HITL confirm no longer clears itself in `finally` (confirm pay actually continues).
- Evidence writes are tmp+rename. Traces redact key material.

## 0.0.30

### Corrected

- `/app` red is cream-cut and ink-cut via `color-mix` (wash, fill, text). No raw `#e10600` on cream. Check uses a cream veil. Desk unchanged.

## 0.0.29

### Corrected

- `/app` console is cream paper with bright red accents (check, rails, chips, stamp, links). Dense layout from 0.0.28 kept. Desk OLED unchanged.

## 0.0.28

### Corrected

- `/app` is a full-viewport dark console: ask + desk chips, stamp, check, live trace, evidence receipt, rails, agent params. Same hop as `/desk`. Paper Increase layout stays on `/` only. Desk OLED unchanged.

## 0.0.27

### Added

- Public site at `/` uses Increase’s paper layout (Newsreader + IBM Plex, product cards, numbered path, rails). Copy is labels/steps only.
- `/app` is the same hop as the desk, on that paper UI: ask, chips, stamp, check. Trace starts closed. Query/protocols stay under `agent`.
- `/desk` keeps the night-desk composite.

## 0.0.26

### Corrected

- Desk plate has no bunny or wheel. They sit as one alpha prop on the wood (shared shadow). In-flight query spins only a circular mask of the same wheel texture; the stand stays planted. No second wheel card.

## 0.0.25

### Corrected

- HTTP 402 `accepts` JSON is the unpaid invoice, not a failed hop. Workbench no longer dumps it into Evidence. After pay, the screen shows the industry stamp (`over` / `not over` / `hold` / `release`), observed total, and a HashScan link from `settlement.ref`.
- First view is the industry ask + stamp (`check`). Query type, protocols, lag, and X-PAYMENT stay available under `agent` — not hidden, just not the default screen. 402 invoice never dumped into Evidence. HashScan from `settlement.ref`.

## 0.0.24

### Corrected

- Overlay plates (bunny, wheel, rain-glass) now have punched alpha, not studio black. Wheel disc (no stand) sits on the plate wheel and spins while a query is in flight. Rain is a soft drip on the window above the laptop, not over the bunny.

## 0.0.23

### Corrected

- Desk is a 16:9 first-person plate. Query UI is mapped onto the laptop screen in the photo (no floating chrome). Bunny + wheel live in the plate on the left. Rain is a window overlay only. Wheel spins while a query is in flight.

## 0.0.22

### Added

- First-person night desk: generated room plate, window rain (streaks + glass), full-size bunny + wheel (spins / hops while `POST /v1/query` is in flight). Workbench sits on the laptop screen as an OLED terminal with Graph / Hedera / CRE agent lamps. Same query, pay, trace, evidence, WALL controls.

## 0.0.22

### Corrected

- Paid hop no longer dies with a bare `fetch failed` when Ethereum RPC (`publicnode`) is unreachable on Windows IPv6. API uses IPv4-first DNS, RPC fallbacks, and still joins whichever Graph books succeed. Trace names the host that failed.

## 0.0.21

### Corrected

- Paid `policy_check` no longer fetches 1000 markets plus 24h of liquidations per book. That query timed out after Blocky402 settle and returned stale (`join failed after settle`). Default 78% check uses protocol TVL/borrow/deposit only. Trace now includes the Graph error text.

## 0.0.20

### Corrected

- Workbench no longer imports the Node join/hash barrel. White screen on `/` was `node:crypto` pulled in through `@hop/shared`. UI now uses `@hop/shared/ui`. Meta fetch cannot crash first paint.

## 0.0.19

### Added

- Local bootstrap scripts: generate Hedera ECDSA keys into gitignored `.env`, resolve faucet-funded account ids, readiness check (Blocky402 + Graph). Does not start servers.

## 0.0.18

### Added

- Phase D roadmap: line audit of the local doc corpus vs shipped API/store/UI, live prize rules, remaining prize-take vs post-hack commercial. Next work is owner rails and tape, not a new engine.

## 0.0.17

### Corrected

- Default policy matches the risk-desk ask: both books over 78% used (`utilization` + `scope: all` = min utilization, and both protocols must have a defined util). Combined-TVL blend is no longer the default stamp.
- Workbench maps any 503 (including `graph_unconfigured`) to a deny state.

## 0.0.16


### Added

- Workbench reads `GET /v1/meta` (deployments, demo-sign flag, WALL buffer). Live SSE traces. `X-PAYMENT` field so agents pay without demo signer. Demo sign is fallback only when enabled.

## 0.0.15

### Added

- MCP `hop_query` / `hop_evidence` (`apps/mcp`). `skills/hop-query/SKILL.md` for the 402 → Hedera exact retry.

## 0.0.14

### Added

- Evidence persistence + TTL. Optional HCS submit of evidence hash (id, aggregate hash, settlement ref) when operator + topic are set.

## 0.0.13

### Added

- Payment payload replay reject. Bounded JSON body. CORS from `HOP_CORS_ORIGIN`. Outbound fetch timeouts. Graph URL only with key or explicit URL (no silent gateway). `feePayer` cache. Parallel Graph fetch. 12s snapshot TTL. `policy_check` skips position pagination. CRE runtime config has no API keys.

## 0.0.12

### Added

- Workbench: night desk, rain window (decoration), bunny wheel while in flight, partner rail (Graph / Hedera / CRE), mic-first ask, industry chips (`policy_check` analogs), live trace, evidence drawer, WALL second screen from paid aggregate only, mute TTS default on.

## 0.0.11

### Added

- `POST /v1/query` charge table: 402 (live `feePayer` from Blocky402 `/supported`), verify/settle, `Idempotency-Key`, payer allowlist + rate limit, policy 503 before settle, paid 200 for success/stale/k-anon. `GET /v1/evidence/{id}`. SSE traces. Optional `POST /v1/demo/sign` (`ExactHederaScheme`).

## 0.0.10

### Added

- CRE `handlerInTee`: `getSecret` policy table, live Graph via `HTTPClient.sendRequest` (TeeRuntime), schema-true join, empty table → `policy_unavailable`. Badge remains `CRE: simulation`.

## 0.0.9

### Added

- Shared Hop engine: Messari 3.1.0 GraphQL, live snapshot fetch (sync CRE / async API), schema-true join for `market_params`, `position_counts`, `liquidations`, `policy_check`, `account_ltv` (k=5 bins). Policy parser hashes caps and never returns them. WALL helper reads an already-paid aggregate only. Pinned Graph IDs: Aave v3 Ethereum `JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk`, Compound v3 Ethereum `AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9`.

## 0.0.8

### Added

- Marketing industry flows (risk desk, insurance, trade). Same `policy_check`; insurance/trade are analogs.

### Changed

- Packages and brand ROOM → Hop (`@hop/*`, `cre/hop-query`, `HOP_*`).

### Corrected

- Implementing the plan qualifies; it does not guarantee a win. Do not copy Lisbon `Scipio`.

## 0.0.7

### Changed

- Public git: README + OpenAPI + code. `docs/`, `THREAT.md`, Cursor/agent files stay local.
- Workbench lock: night desk, rain as decoration, bunny on a wheel, partner rail, mic-first, real traces.
- Hedera display may be USDC HTS `0.0.429274`; settlement stays Hedera/Blocky402.

### Corrected

- ETHGlobal video: no TTS, no phone.

## 0.0.6

### Added

- Implementation master prompt.
- Init scaffold: API, web, CRE `handlerInTee`, shared types, OpenAPI, `llms.txt`, README payment flow. Routes `501`.

## 0.0.5

### Changed

- Spec logic patches: schema-true Graph metrics, HBAR/HTS 402, CRE sim, k-anon on account bins only, charge table, `ExactHederaScheme`.

### Added

- Outside flow critique (P0 folded into spec).

## 0.0.4

### Changed

- Locked product menu: Hop (NDAI+CRE), PROVA fallback, WALL as optional second screen.

## 0.0.3

### Added

- Hardware/Arduino thesis menu.

### Changed

- Hardware theses rejected.

## 0.0.2

### Added

- Prize-rule / market strategy audit.

### Corrected

- Three-partner cap; invalid prize stacking; Ledger `ring destroy`; Graph $0.01; GENIUS yield reading.

## 0.0.1

### Added

- ETHOnline brainstorm exports (docs only). Combo desk / METER Guard — later superseded.
