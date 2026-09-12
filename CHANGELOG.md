# Changelog

## 2026-09-11 (night)

### Added

- `docs/10-marketing-industry-flows.md`: layman flows for three industries (digital-asset risk desk, insurance, letter of credit). Same Hop engine; week-1 tape is Graph; insurance/trade labeled analogs. Site language uses **house limit / cutoff**, not “private.”

### Changed

- Code + packages renamed ROOM → Hop: `@hop/api`, `@hop/web`, `@hop/shared`, `cre/hop-query`, UI `HOP`, env `HOP_*`.

### Corrected

- `docs/07`: implementing the plan **qualifies**; it does not guarantee a win. Do not copy ETHGlobal Lisbon `Scipio`/`ethglobal-lisboa` (vault + Graph x402). Wedge is Hedera-sold service + CRE private policy + evidence.

## 2026-09-11 (evening)

### Changed

- `.gitignore`: `docs/`, `THREAT.md`, Cursor/agent files (`AGENTS.md`, `.cursor/`, canvases, handoffs), secrets, and local CRE env stay off git. Public repo is README + OpenAPI + code.

- Locked workbench UX in `docs/07` and `docs/09`: night desk, rain window as decoration only, bunny runs a wheel while waiting (not a partner logo), three partner agents on the laptop rail, mic-first ask, real traces, marketing chips as analogs of the same `policy_check`.
- Hedera display asset may be USDC HTS `0.0.429274`; settlement remains Hedera/Blocky402 (no DEX convert, no Base USDC). Thesis in `07` no longer says “not USDC” — it means not **Base** USDC.

### Corrected

- ETHGlobal submission video still **no TTS, no phone**. Mute app TTS when recording. Fake terminal logs do not qualify for Graph or Chainlink.

## 2026-09-11

### Added

- `docs/09-implementation-master-prompt-2026-09-11.md`: paste-ready implementation prompt for a new agent chat (ROOM only; spec is `07`).
- ROOM init scaffold (no paid path yet): `apps/api`, `apps/web`, `cre/room-query` (`handlerInTee`), `packages/shared`, `openapi/openapi.yaml`, `llms.txt`, `THREAT.md`, root README (Blocky402 payment flow + architecture). Routes return `501 not_implemented`.

## 2026-09-08

### Changed

- Folded logic-only patches into `docs/07-where-we-are-2026-09-07.md`. Calendar/time-cut language dropped from the spec (event window Sep 4–16).

### Corrected (in `07`)

- ROOM queries are schema-true Messari 3.1.0 (`market_params`, `position_counts`, `liquidations`, `policy_check`; optional computed `account_ltv`). `Market.maximumLTV` is a protocol parameter, not position LTV.
- Graph is the public join; the CRE secret is the policy table. k-anon applies to account bins only.
- CRE: sim qualifies; workflow binary is not confidential.
- ROOM 402 is HBAR (`0.0.0`) or HTS via Blocky402 with facilitator `feePayer`. WALL USDC is display-only and must not pull Graph again or settle the query.
- Charge table: unpaid = no charge; stale / k-anon = paid 200; missing policy = 503; idempotency required.
- Hedera client is `ExactHederaScheme`, not a generic USDC `fetchWithPayment`.

### Added

- `docs/08-flow-critique-2026-09-08.md`: outside critique (P0 logic marked patched in `07`).

## 2026-09-07 (night)

### Changed

- Rewrote `docs/07-where-we-are-2026-09-07.md` as three products: **ROOM**, **PROVA**, **WALL**. Tightened ROOM to a confidential lending-risk query (NDAI paper vs Prova sandbox; iExec as closest competitor).
- Added ROOM firm pack: HTTP 402/OpenAPI/MCP as the agnostic plug-in; one-line client; audit evidence vs “compliant AI”; small Hedera firm script; MVP vs out-of-scope list.

### Corrected

- NDAI: paper is Arrow hold-up / ironclad NDA; generic TEE marketplaces are crowded; prize-native metered query over live Graph + CRE is the remaining wedge.
- WALL is not production-compliant as a T-bill or family-office yield product. GENIUS issuer yield ban is expected **Jan 18, 2027** and does **not** grant BD/RIA/MSB licenses. Paid x402 sweep decisions can still be advice. BENJI is a registered MMF (low prospectus minimum); BUIDL is QP/allowlist. ATS demo label: simulated, no investment rights.

## 2026-09-07 (late)

### Added

- `docs/07-where-we-are-2026-09-07.md`: locked **WALL** as the submission product. One focused flow: Prova-shaped Hedera x402 evidence + payment-USDC vs investment sleeve + ATS simulated treasury token. tx-bundler pattern (measure → decide → subscribe/redeem), not a lending desk.

### Changed

- Rejected Arduino/hardware theses in `06`. Rejected rebuilding the METER+REPO+POOL combo desk.
- Third partner stays Ledger (Key Ring + wall-cross confirm). Arc deferred to avoid the Hedera↔USDC bridge. Privy is the org-wallet substitute.

### Corrected

- GENIUS pitch: issuer (and issuer-tied) yield-on-USDC ban, not “agents cannot earn yield.” ATS token must be labeled simulated, not a T-bill.

## 2026-09-07 (evening)

### Added

- `docs/06-prova-hardware-menu-2026-09-07.md`: ten from-scratch theses (hardware, consumer, software) mapped to the official three-partner cap and live prize text. Recommended product is **Latch** (Arduino intent pad + Ledger Key Ring + Hedera x402 evidence API + live Graph).

### Changed

- Product direction moved off METER Guard. Same Graph + Hedera + Ledger partner slot, different job: physical latch and paid evidence, not a procurement control plane.
- Prova is a pattern source only. Classic track still forbids submitting `ic3-26` or Continuity.

### Notes

- Arduino is UX (display/buttons). Ledger device confirm is the security boundary. Do not claim the pad is a TEE or HSM.
- World AgentKit, Graph AI Continuity, and other Continuity-only tracks remain out of scope on Classic.

## 2026-09-07

### Added

- Exported all ETHOnline brainstorm canvases to `docs/` as markdown (Cursor canvas tabs/links were not viewable).
- Research lock: Engine A = METER+GHOST, Engine B = REPO+POOL, SPLIT as policy/hook on the same desk.
- Prize scenarios, CVM alternatives (Graph x402, Ledger Key Ring, CRE TEE, Nanopayments, optional Phala tdx.small), Uniswap v4 permissioned-pool wow, Agent0-as-credit-bureau.
- Added `docs/05-strategy-audit-2026-09-07.md`, a current-source audit of the product thesis, ETHOnline rules and prizes, agent-payment market, technical standards, regulatory boundaries, competition, UX, security, business model, and build scope.

### Changed

- Reframed the submission as one METER Guard product: evidence-backed procurement for financial agents.
- Recommended The Graph + Hedera + Ledger as the coherent three-partner prize portfolio, with Privy as the hardware-unavailable alternative.
- Deferred REPO, POOL, SPLIT, Chainlink liquidation, Uniswap, ENS, World, and multi-chain work until after the core submission.
- Marked the original brainstorm index as superseded by the full audit.

### Corrected

- ETHGlobal permits at most three partner-prize selections; prior full-desk prize stacking and the ~$13k base case were invalid.
- Removed the unsupported `wallet-cli ring destroy` thesis; Ledger Key Ring secrets are seed-recoverable and no destroy command is documented.
- Removed the unsupported assumption that Graph x402 queries have a fixed $0.01 cost.
- Corrected the GENIUS Act reading: the yield restriction applies to permitted payment stablecoin issuers, not generally to an agent deploying USDC into a separate product.
- Reclassified ERC-8004/Agent0 as a draft, Sybil-prone signal source rather than a standalone credit bureau.
- Separated signed evidence from remote TEE attestation; Ledger Key Ring does not attest METER computation.
- Flagged the missing Hedera-to-Arc collateral bridge/proof/liquidation design as a critical reason to defer REPO/POOL.
- Clarified that an ATS test token is not legally a T-bill and the documented collateralized loan is not yet a repo.
- Corrected the old METER upside arithmetic and lending payer map.

### Notes

- No application code yet. Docs only.
- From-scratch track. Do not register Continuity. Do not resubmit Prova (`ic3-26`).
