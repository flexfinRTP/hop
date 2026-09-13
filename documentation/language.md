# Hop protocol language

**Source of truth for category, buyers, market, GTM, and copy.** Technical truth lives in this directory. Product UI stays labels and steps. Pitch language is the voice. This file is the commercial lock.

If copy and code disagree, code wins and this file is amended. If a deck and this file disagree, this file wins.

**Sunset 0.1.0.** Archive. Finance lending policy gate is the shipped demo. The SKU is the hop, not the vertical. Other sectors below are the same contract with a swapped warehouse — not extra products, not shipped subgraphs. No further product work.

---

## The lock

**Check. Decide. Prove.**

That is the public 1-2-3. A desk lead in any industry: before the agent spends, books, or ships, it checks the house rule, gets allow or hold, and you keep a receipt.

Do not lead with **Pay → Decide → Verify**. That is the protocol meter, not the job. Paying first sounds like the agent spends before it is allowed to. Wrong. Hedera exact x402 is how the *check* is billed — a number, not a prompt. Then the verdict. Then the receipt. Then, if ALLOW, the irreversible tool may run.

Private policy. Public settlement. Verifiable evidence.

Agents can spend. The log is the model’s word. Nothing stops the hop before it acts. Caps live in a prompt. A later attest does not stop the action.

Hop sits **before** the action. One paid request. One decision receipt.

Finance is the demo. The product is the hop.

**Don’t trust the agent. Trust the receipt.**

---

## Category

**Verifiable decision infrastructure for agents.**

Not a model. Not a wallet. Not a chatbot. Not a KYC wrap. Not an attest-after log. Not GRC-as-a-PDF. Not a token budget.

Hop sells a composed decision object: enumerated query, explicit data keys, sealed policy, public pay, public receipt.

| Public 1-2-3 | Job | Protocol (do not put this first on `/`) |
| --- | --- | --- |
| **01 Check** | Before it spends, books, or ships. House limit stays private. | Unpaid `POST /v1/query` → 402. Hedera exact x402 is the meter on the check. |
| **02 Decide** | ALLOW · HOLD · DENY · REVIEW. If not allowed, the irreversible call does not run. | Sealed policy. Public books. Caps omitted. |
| **03 Prove** | `/verify/{id}`. Audit gets a link. Names what was not verified. | Hashes. HashScan. CRE mode. Optional HCS. |

---

## Why an enterprise uses this

You are about to let software act — spend, bind, book, dispatch, change a setpoint. The board will not accept “the model said so.” Gartner kills **40%+** of agentic projects by 2027 for **inadequate risk controls**, not for a weak model.

Hop is the control that lets the agent into production.

| You need | What Hop is | What you do not buy |
| --- | --- | --- |
| A stop **before** value moves | Gate on the hop. ALLOW / HOLD / DENY / REVIEW | A chat log. An attest after the loss |
| Policy that does not leak | Caps stay sealed. Never in the HTTP result | A prompt with the limit in it |
| Spend that is a number, not a paragraph | Mandate: budget, velocity, expiry. L2 human. L3 passport | A cap in Slack |
| Evidence a counterparty can open | Public `/verify/{id}` + HashScan. Names what was **not** verified | A vendor dashboard only you can see |
| Fail closed | 503 before settle if data, policy, or compute is down | A ghost green light |
| To keep the business | You keep policy, keys, agent, customer | A new ERP, a new model, a KYC vendor |

**One sentence for the CRO / VP Ops / CISO:**

You do not put Hop in because you like blockchain. You put it in because an agent that can move value without a receipt is an uninsured process — and you will not scale that.

**What changes in the enterprise**

- Audit asks “show the decision.” You send a link, not a screenshot of a chat.
- Legal asks “did we screen OFAC?” The receipt says `not_screened`. Honest. No fake clearance.
- Risk asks “who paid, how much, which book?” HashScan + subgraph ids on the pack.
- Ops asks “can we run autonomous?” Default is autonomous. Human only at the L2 threshold you set.
- Finance asks “can it run away?” Mandate remaining ticks. One key, one evidence id. No refunds: charge for the attempt, so retries are real.

You do not replace the agent platform. You put **one hop in front of the irreversible tool call**. Same pattern in finance, insurance, plant, grid, freight, procurement, commercial property.

---

## Why it goes in the agent workflow

The agent already calls tools. One of those tools is about to do something that cannot be undone. Hop is the tool call **before that**.

```text
map the ask → POST /v1/query
     unpaid → 402
     pay exact x402
     200 ALLOW | HOLD | DENY | REVIEW
     if ALLOW → call the real tool
     attach /verify/{id} to the trace
```

| If you skip Hop | If you put Hop in |
| --- | --- |
| The model picks a subgraph and hopes | Enumerated query. Explicit protocol keys. No NL parser. No caller GraphQL |
| Login wall / API key in the prompt | No API key. No OAuth on query. Agent files: `llms.txt`, OpenAPI, SKILL, Agent Card |
| Budget is a system prompt | Mandate remaining. The model does not pay |
| Double-pay on retry | Idempotency-Key. One settlement per request |
| Proceed when the join is down | 503 before settle. Agent stops. |
| Next step has no proof | `hop.decision.v1` + `verify_path`. Stamp optional DID. Keep going |

**One sentence for the agent engineer:**

You add one 402-retry tool. You get a verdict and a receipt. You do not write a policy engine, a pay rail, or an audit pack.

**Why the agent wants it (not just the boss)**

- Seconds to wire. Point at the files. Hedera exact retry is the skill.
- Deterministic: same query types, same keys from `GET /v1/meta`.
- Paid path is the internet’s: HTTP 402, `X-PAYMENT`, retry. Not a portal.
- HOLD / DENY is a first-class result, not an exception to swallow.
- Receipt id is portable — ticket, trace, next agent, human.

Do not put Hop on every token. Put it on the hop that **spends, binds, or actuates**.

---

## Blue ocean

Red oceans are full. Models. Copilots. Observability. Identity. Attest-after. Token meters. GRC suites that report last quarter.

The empty space: **a decision with a receipt, before the agent acts, across any sector that has a live book and a private limit.**

That is not a crypto niche. That is every enterprise that will let software move money, inventory, energy, freight, coverage, or a setpoint.

Gartner: by 2028, **15% of day-to-day work decisions** run autonomously (from 0% in 2024). **33% of enterprise software** includes agentic AI. **90% of B2B buying** is agent-intermediated — **more than $15 trillion**. Also Gartner: **over 40% of agentic projects canceled by end of 2027** — escalating costs, unclear value, **inadequate risk controls**. Not the model. The gate.

McKinsey: 62% of orgs experiment with agents; **23% scale**. S&P / McKinsey: **31%** run an agent in production; **banking and insurance ~47%**. Manufacturing jumped to **58–77%**. Energy ~**50%**. Operations / supply chain department adoption **49%**.

The buyer is not “an agent platform.” The buyer is the person who owns the threshold.

**Title varies. Job does not: they get fired when the agent goes past the limit and there is no receipt.**

| Economic buyer | Why they pay |
| --- | --- |
| CRO / Head of Operational Risk | Autonomous decisions with no evidence pack |
| VP Operations / Plant / Grid | Agents changing setpoints, energy, quality, load |
| CISO (rising AI-risk budget, Forrester) | Tool calls that move value; no kill switch on the hop |
| Chief Claims / CUO | Agents on submissions and claims with no appetite gate |
| VP Supply Chain / CPO | Freight and procurement agents inside “approved limits” with no public record |
| Treasurer / Controller | Spend and liquidity agents; mandate is a comment in a prompt |
| Head of AI / CAIO | Champion. Needs a rail that legal and risk will let into production |

Technical buyer: AI platform / integration. User: the agent (pays x402). Blocker: legal — if we claim KYC, OFAC, or “compliant AI.” We do not.

---

## Problem

Three failures. Pitch language. Do not decorate.

| | | |
| --- | --- | --- |
| **No gate** | A tool call can move value. Nothing stops the hop before it pays. | The action happens. The policy is a comment. |
| **No meter** | Caps live in a prompt. Spend is not bound to the attempt. | Budget is theatre. |
| **No receipt** | A later attest does not stop the action. Identity-only auth does not bind the verdict. | Audit after loss. |

Adjacent products do one job. Hop binds four: **gate + pay + join + receipt**, on the same hop.

---

## What Hop is

Hop provides the rail. The operator keeps the policy, the agent, the keys, and the customer.

**Hop provides**

- A paid HTTP decision gate (x402, not OAuth)
- Confidential policy against live public (or warehouse) data
- A public, copyable receipt that names its own limits
- Mandate, passport, optional DID / ERC-8004 — controls, not a login wall
- Agent files: `llms.txt`, OpenAPI, SKILL, Agent Card, `did.json`

**Hop never**

- Holds payer keys
- Parses natural language or accepts caller GraphQL
- Prints policy caps
- Screens OFAC or performs KYC
- Sells Stripe, Visa TAP network, Graph Base USDC x402, or private payments
- Becomes the model, the wallet, or the regulated balance sheet

The receipt says what was not verified.

---

## Use cases — same hop, every sector

Live tape today: **finance.** Everything else is the same SKU: live books in, sealed cap, posted verdict, public pay. Swap the warehouse. Keep the receipt. Do not claim those warehouses are live.

| Sector | Agent is about to | Private cap (sealed) | Live book (posted identifiers) | Economic buyer |
| --- | --- | --- | --- | --- |
| **Financial services** | Rebalance, borrow, route liquidity | Utilization / exposure limit | Lending protocols (Aave + Compound on tape) | CRO, treasury ops |
| **Insurance** | Bind, pay a claim, accept a submission | Appetite / incident cap this window | Loss, incident, or book metrics | CUO, chief claims |
| **Industrial / manufacturing** | Change a setpoint, release a batch, schedule | Quality, OEE, energy envelope | Plant / MES / historian feeds | VP operations, plant manager |
| **Energy / utilities** | Dispatch, shed load, trade imbalance | Operating envelope | Grid / asset telemetry | Grid ops, asset performance |
| **Logistics / freight** | Book a carrier, file a claim, pay a lane | Spend / service guardrail | TMS / rate / milestone graph | VP supply chain |
| **Procurement / commercial** | Award a PO, pay an invoice | Mandate, vendor policy | ERP / AP / catalog | CPO, controller |
| **Commercial real estate / facilities** | Capex, work order, energy spend | Operating buffer | BMS / occupancy / spend | Asset manager, facilities |
| **Telecom / networks** | Change routing, capacity | SLA / load cap | Network telemetry | Network ops |
| **Retail / inventory** | Replenish, markdown, route | Stock / margin floor | Inventory + demand | COO, merchandising ops |
| **Public sector / education** | Commit appropriated spend | Budget line | Ledgers / utilization | Controller (later; procurement-slow) |

Healthcare clinical decisioning is **out**. Healthcare ops (staffing, beds, spend) can map later. Do not claim HIPAA.

Pattern, every row: **private policy. public books. verifiable evidence.**

---

## Market

Parent markets are large. Hop does not own them. Do not pitch $15T or $202B as Hop’s TAM.

### Demand (why the category exists)

| Fact | Number | Source |
| --- | --- | --- |
| Autonomous day-to-day work decisions by 2028 | 15% (from 0% in 2024) | Gartner, Jun 2025 |
| Enterprise software with agentic AI by 2028 | 33% (from <1% in 2024) | Gartner, Jun 2025 |
| B2B buying agent-intermediated by 2028 | 90%, **>$15T** spend | Gartner, Oct 2025 |
| Agentic AI projects canceled by end 2027 | **>40%** — cost, value, **risk controls** | Gartner, Jun 2025 |
| Standalone AI agents market | **$10.9–12.1B (2026) → $50–53B (2030)** | Grand View / Research and Markets |
| Gartner embedded agentic inside software | **$202B (2026) → ~$1T (2030)** | Gartner AI spending, 2025–26 |
| Enterprises with an agent in production | 31% (banking & insurance ~47%) | S&P Global / McKinsey, 2026 |
| Orgs scaling agents | 23% | McKinsey |
| Mature governance for autonomous agents | 21% | compiled 2026 enterprise stats |
| Industrial AI agents | **$6.9B (2026) → $54.8B (2035)** | Globe Market Research |
| Agentic AI in energy & utilities | **$4.8B (2026) → $36.2B (2036)** | Fact.MR |
| IIoT (data plane under industrial agents) | **$603B (2026)** | Precedence Research |
| GRC software (adjacent, mostly not runtime) | **~$23B (2026)** | Mordor / QY |
| Policy-as-code | **$3.2B (2025) → $12.8B (2034)** | Dataintelo |
| AI observability & governance (Gartner DSML) | **$1.3B (2026) → $4.0B (2029)** | Gartner 4Q25 forecast recap |

x402 is the pay standard Hop already speaks. Linux Foundation x402 Foundation (Jul 2026): Visa, Mastercard, Amex, Stripe, Google, AWS, Cloudflare, Coinbase. Agentic payments are a stack (AP2 mandate, TAP identity, x402 settlement). Hop is **decision + Hedera exact x402**, not Visa TAP and not Stripe checkout.

### TAM / SAM / SOM

Planning estimates. Not audited. Not a promise of revenue. Testnet today.

**TAM — 2030, the job.** Runtime pre-action decision + meter + receipt. Not chat. Not quarterly GRC. Not the $15T of goods agents will buy.

| Build | 2030 | Notes |
| --- | --- | --- |
| Policy-as-code | ~$8B | $3.2B in 2025 @ ~18.5% CAGR |
| AI obs / governance | ~$4B+ | Gartner $4.0B in 2029 |
| Agent control-plane (new, net of overlap) | ~$2–4B | SatGate / Unity Gateway / Permit-class runtime; category forming |
| **Hop TAM (planning)** | **$8–12B** | Intersection: sealed policy × live data × paid hop × receipt |

Take-rate check: $15T agent-intermediated B2B × **0.5–1 bp** as decision infrastructure = **$7.5–15B**. Same order of magnitude. Do not add the two. They overlap.

**SAM — 2030, who Hop can sell.** NA + EU operators who will let an agent act against a **live book and a private limit**, plus the platforms those agents already call.

In: financial ops, insurance, industrial, energy, logistics, procurement, commercial property/facilities, telecom ops, retail ops. Out: copilots that only draft, KYC vendors, attest-after, token-only gateways, clinical care.

**Hop SAM (planning): $1.5–2.5B** — roughly the “threshold vs live data” slice, not IAM and not observability.

**SOM — 24 months, honest.** Testnet. No production ACV on tape.

| Horizon | Target | What it assumes |
| --- | --- | --- |
| Now | $0 revenue | ETHOnline tape. Hedera testnet. Finance demo. |
| 12 months post-hosted API | **$0.5–1.5M** | 8–15 design partners. Mix of agent platforms (PLG hops) + 3–5 enterprise pilots at **$50–150k**. One industrial or logistics warehouse proof. |
| 24 months | **$3–8M** | Repeatable hop SKU. 25–40 accounts. Land finance + one heavy-ops vertical (industrial **or** freight). Still not a GRC suite. |

If hosted API and design partners do not exist, SOM stays **$0**. Do not put SOM in a judge deck as if it were booked.

---

## GTM

Two motions. Do not collapse them.

| | User | Buyer |
| --- | --- | --- |
| **Who** | The agent | The operator who owns the threshold |
| **Motion** | PLG | Design partner → paid pilot |
| **How** | `llms.txt` / OpenAPI / SKILL / Agent Card. HTTP 402. No login. Hedera in seconds. | CRO / VP Ops / CISO / CUO / CPO. One hop on their book. Receipt they can forward. |
| **Price** | Per hop (metered). Mandate is the budget object. | Pilot ACV, then hop volume + mandate seats. SLA only after the receipt is honest on mainnet. |

**Beachhead (now).** Finance lending policy gate. Agent platforms and crypto-native operators who already pay x402. Hedera, The Graph, Chainlink ecosystems. Tape is the sales deck.

**Land.** Same hop. Swap the warehouse. First expansion: **industrial / energy / logistics** (live books, private envelopes, VP Operations as buyer) **or insurance** (47% production agents, humans still final approver — Hop is the gate they lack). Pick one. Do not boil the ocean.

**Expand.** Mandate L1–L3, passports, `/verify/{id}` as the object audit already asked for. More warehouses. Not a new product line per sector.

**Channels.** (1) Agent PLG. (2) Partner rails (Hedera / Graph / CRE). (3) ISVs that already sit on the book: TMS, MES, core insurance, treasury. (4) Direct enterprise, short list.

**Do not.** Stripe because a competitor has Stripe. Visa TAP as the pitch. KYC. “Compliant AI.” ATS as the landing. Extra health/identity verticals in code until this file reopens them.

**Sequence**

1. Tape. One paid hop. HashScan. `/verify/{id}`.
2. Hosted API. Same contract.
3. Five design partners: two agent platforms, two finance/insurance ops, one industrial or freight.
4. Second warehouse live. Same receipt.
5. Price book: hop + mandate. Enterprise only after fail-closed is boring.

---

## Competitive frame

Different layer. Do not clone.

| Layer | Example | Job | Hop |
| --- | --- | --- | --- |
| Model | Venice, labs | Chat / reason | Not a model |
| After | Prova | Attest after the action | Gate **before** |
| Authz | Permit, OPA, Cedar | Who may call | Verdict bound to the hop |
| Meter | Nevermined, Unity Gateway | Token / spend caps | Meter **and** join policy |
| GRC | ServiceNow, OneTrust | Report and attest | Runtime receipt |
| Engine | CRE | Confidential compute | Metered HTTP in front of the engine |
| Pay | x402, AP2, TAP | Move value / identity | Decision + Hedera exact on the same hop |

They prove what happened. We decide whether it may.

---

## Voice

Pitch language. Short. Certain. Specific.

- **Check. Decide. Prove.** Default public rhythm. Protocol meter (402 / Hedera) is how the check is billed — never “pay then think.”
- Prefer a HashScan, a 402, a `/verify/{id}` over an adjective.
- FOMO is structural: 15% of decisions autonomous, 40% of projects killed for missing risk controls, $15T B2B through agents. The window is the gate, not a discount.
- Honesty is brand. Testnet. CRE simulation. OFAC not screened. DON `—` until matched.
- No theatre: revolutionary, seamless, unlock, magic, bank-grade, compliant AI, trustless-as-a-blanket.
- Product UI: labels and steps only. This file, `/pitch.html`, partner, investor: longer sentences.

---

## Locked lines

Use verbatim unless this file changes.

**Identity**

- Verifiable decision infrastructure for agents.
- Private policy. Public settlement. Verifiable evidence.
- Check. Decide. Prove.
- Before an agent acts, get a decision with a receipt.
- The check is a paid Hedera hop. That is the meter, not pay-then-think.
- Don’t trust the agent. Trust the receipt.
- One paid request. One decision receipt.
- Finance is the demo. The product is the hop.
- The receipt says what was not verified.
- Decision is private. Payment is public on Hedera. Data source is public on The Graph.

**Problem / cover**

- Agents can spend. The log is the model’s word.
- No gate. No meter. No receipt.
- Before an agent acts, get a decision with a receipt.

**Why enterprise**

- You put it in because an agent that can move value without a receipt is an uninsured process.
- The board will not accept “the model said so.”
- One hop in front of the irreversible tool call.
- Already on x402: one more 402 resource. MCP / no x402: one skill in the tray.
- Audit gets a link. Not a screenshot of a chat.

**Why the agent workflow**

- The tool call before the tool call that cannot be undone.
- You add one 402-retry. You get a verdict and a receipt.
- Do not put Hop on every token. Put it on the hop that spends, binds, or actuates.

**Integrate**

- Hook up your agent in seconds.
- No API key. No login. Hedera exact x402.
- Point your agent at the files.

**Market / GTM**

- The buyer owns the threshold.
- Same hop. Every sector. Swap the warehouse. Keep the receipt.
- Built on Hedera. Standardized for x402. Built on Chainlink CRE. We start with The Graph.

**Close**

- Don’t trust the agent. Trust the receipt.
- CRE is compute. Hop meters the decision.

---

## Words we use

Hop · hop · rail · gate · join · verdict · receipt · mandate · passport · sealed · posted · charge-for-attempt · fail closed · warehouse · operator · threshold · testnet (when true)

Verdicts: **ALLOW · HOLD · DENY · REVIEW**. Screening: `ofac: not_screened`, `kyc: not_performed`.

## Words we never use

| Forbidden | Why |
| --- | --- |
| Compliant AI / bank-grade | Not claimed. |
| TEE (unqualified) | Say CRE simulation or DON when matched. |
| Private payments | Settlement is public. |
| KYC / OFAC cleared | Not performed. |
| Stripe / Visa TAP / Graph Base USDC x402 | Not the pay rail. |
| $15T TAM / $202B TAM | Parent markets. Not Hop’s TAM. |
| Mainnet (until it is) | Testnet. |
| Revolutionary, seamless, unlock, magic | Theatre. |
| Attest / wrap any action | After-the-fact category. |

---

## Claims we may make

Only if the tape still shows them.

- Unpaid `POST /v1/query` → HTTP 402. No API key. No login.
- Hedera exact x402. `payment.rail = hedera_x402_exact`.
- Caps omitted from 200 and evidence.
- Live Graph: Messari 3.1.0, Aave v3 + Compound v3, subgraph ids on the pack.
- CRE join. Simulation until DON matches.
- Charge-for-attempt on `stale` / `k_anon_denied`.
- Fail closed before settle on 503.
- Public `/verify/{id}`.
- Optional passport / DID / ERC-8004. Not required to pay.
- Query is x402, not OAuth.

**Market claims** must cite the table in this file. Do not round parent markets into Hop revenue.

## Claims we never make

- Hardware TEE on CLI simulate
- OFAC, KYC, HIPAA, FINRA, MSB
- Live industrial / insurance / freight warehouses (until they are)
- Booked SOM
- Refunds, private payments, Stripe, Visa as pay rail
- A model runtime inside Hop

---

## Honest status

| Surface | Print |
| --- | --- |
| Tag | **0.1.0 sunset** |
| Network | Hedera **testnet** |
| CRE | **SIMULATION** unless DON matches. Local simulate is not a hardware TEE |
| Screening | OFAC not screened. KYC not performed |
| Vertical | Finance demo live. Other sectors = same hop, warehouse not live |
| Revenue | $0 on tape |
| Custody | Non-custodial |
| Regulatory | Not MSB / CASP / RIA. Not insurance. Not credit |
| Product work | Closed. Run the archive or leave it. |

---

## Sources

| Claim | Source |
| --- | --- |
| 15% autonomous work decisions; 33% software agentic; 40%+ projects canceled | [Gartner, 25 Jun 2025](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) |
| 90% B2B buying / >$15T by 2028 | [Gartner, 21 Oct 2025](https://www.gartner.com/en/newsroom/press-releases/2025-10-21-gartner-unveils-top-predictions-for-it-organizations-and-users-in-2026-and-beyond) |
| $202B agentic spend 2026; obs/gov $1.3B→$4.0B | Gartner *Forecast: AI Spending, Worldwide*, 4Q25 (recap) |
| AI agents $10.9–12B (2026) → $50–53B (2030) | Grand View Research; Research and Markets |
| 31% production; banking & insurance ~47% | S&P Global / McKinsey 2026 compilations |
| 62% experiment / 23% scale | McKinsey *State of AI* |
| Sector adoption (FS 78%, manufacturing 58–77%, energy 50%, ops 49%) | IDC / Gartner / McKinsey 2026 composite |
| Industrial AI agents $6.9B → $54.8B | Globe Market Research |
| Energy & utilities agentic $4.8B → $36.2B | Fact.MR |
| IIoT $603B (2026) | Precedence Research |
| GRC ~$23B (2026) | Mordor Intelligence |
| Policy-as-code $3.2B (2025) | Dataintelo |
| x402 Foundation; Visa/Stripe/Google | CoinDesk, 16 Jul 2026; Linux Foundation |
| CISO as rising AI-governance buyer | Forrester, via Credo AI buyer guide 2026 |
| Freight / insurance agents in production | project44 (Feb 2026); FurtherAI; Opereit |

TAM/SAM/SOM in this file are **Hop planning ranges** derived from those sources, not third-party Hop valuations.

---

## Surfaces

| Surface | Job |
| --- | --- |
| This file | Canonical language, buyers, market, GTM |
| `/pitch.html` | Locked lines + loop + rails |
| `/` `/docs` `/app` | Labels and steps. No narrative dump |
| [`judge.md`](judge.md) | Scoreable claims. No TAM |
| [`demo-script.md`](demo-script.md) | Spoken tape |
| Investor / partner | Blue ocean + TAM table + honest SOM + sources |

---

## One-page brief

**Hop 0.1.0 sunset.** Check. Decide. Prove. Archive. No further product work.

Agents can spend. The log is the model’s word. Gartner: 15% of work decisions autonomous by 2028, $15T of B2B through agents, and 40% of agentic projects killed for missing risk controls. The missing product is not another model. It is a gate with a receipt.

Hop is verifiable decision infrastructure for agents. Private policy. Public settlement. Verifiable evidence. The operator keeps the policy. The agent pays Hedera exact x402. Caps never print. `/verify/{id}` names what was not verified.

Finance is the live demo — Aave v3 + Compound v3, The Graph, Chainlink CRE, Hedera. Same hop for industrial, energy, insurance, freight, procurement, commercial property. Swap the warehouse. Keep the receipt.

Buyer: the person who owns the threshold. User: the agent.

**Enterprise:** put it in because an agent that can move value without a receipt is an uninsured process. Audit gets a link.

**Agent workflow:** the tool call before the tool call that cannot be undone. One 402-retry. Verdict + receipt. Not on every token — on spend, bind, or actuate.

TAM ~$8–12B (2030 runtime decision infra). SAM ~$1.5–2.5B. SOM $0 until hosted API and design partners exist.

Don’t trust the agent. Trust the receipt.
