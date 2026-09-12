# Changelog

Versions increment by `0.0.x` per feature. No dates.

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
