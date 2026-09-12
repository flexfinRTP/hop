# Changelog

Versions increment by `0.0.x` per feature. No dates.

## Roadmap

Code complete through **0.0.17**. Phase D (0.0.18) is the remaining path: prize take then commercial. Local spec: `docs/11-phase-d-roadmap.md`.

Local test bootstrap is **0.0.19** (`npm run setup:local`). Still needs you: Hedera faucet + Graph Studio API key.

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
