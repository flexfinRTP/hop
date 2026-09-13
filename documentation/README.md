# Hop documentation

Hop is a paid HTTP service that returns a composed decision object. The public demo vertical is finance: enumerated lending-risk queries (`policy_check` and related) over Aave v3 and Compound v3. A caller pays on Hedera, a confidential Chainlink Runtime Environment (CRE) workflow joins live protocol state from The Graph against a private policy table, and the service returns a sanitized decision plus a public evidence pack.

Decision is private. Payment is public on Hedera. Data source is public on The Graph. The receipt says what was and was not verified.

This directory is the technical reference. Commercial language is locked in [`language.md`](language.md). The HTTP contract is [`../openapi/openapi.yaml`](../openapi/openapi.yaml). Agent integration is [`../skills/hop-query/SKILL.md`](../skills/hop-query/SKILL.md). Human docs hub: `/docs`. Judge pack: [`judge.md`](judge.md) (`/docs/judge`). Hosted Swagger: `/swagger.html`.

## Point your agent here

Give an agent this index, `/llms.txt`, `/openapi.yaml`, or `/SKILL.md`. It integrates the Hedera-paid decision API in seconds. No SDK. No API key. No login. No handwritten client. Optional DID stamps the receipt.

| Audience | Start here |
| --- | --- |
| Language / commercial | [Protocol language — source of truth](language.md) |
| Judge | [Scoreable tape + standards](judge.md) |
| Product / operations | [Architecture](architecture.md) |
| Next implementation | [Product implementation plan](product-implementation-plan.md) |
| Operator | [Activation](operator.md) |
| Demo tape | [3-minute script](demo-script.md) |
| Payments | [Hedera x402](hedera-x402.md) |
| Data | [The Graph — standardized lending](the-graph.md) |
| Confidential compute | [Chainlink CRE](chainlink-cre.md) |
| Tokenization | [Hedera ATS](hedera-ats.md) |
| Sepolia defense | [Liquidation challenge](chainlink-liquidation.md) |
| Agents | [MCP, skills, mandates, passports, discovery](agents.md) |
| Identity | [Passports, DID, ERC-8004, HITL](identity.md) |
| Audit | [Evidence, HCS, verification](evidence.md) |

## What Hop is

Hop sells a **composed decision object**, not raw GraphQL. Finance is the demo vertical, not the market.

- Query types are enumerated. The service does not parse natural language and does not accept caller-supplied GraphQL or SQL.
- Protocol sources are explicit keys from `GET /v1/meta`. The service does not pick a hidden subgraph.
- The policy table is a CRE secret. Thresholds never appear in HTTP responses or evidence packs.
- Settlement uses the x402 `exact` scheme on Hedera through the Blocky402 facilitator. Hop does not proxy The Graph’s Base USDC x402 endpoint.
- Public `POST /v1/query` is x402, not OAuth (`GET /.well-known/oauth-protected-resource`).
- Optional `X-Hop-Did` / `X-Hop-Erc8004` / passport stamp the receipt. They are not required to pay.

## Why

- **Enterprise:** an agent that can move value without a receipt is an uninsured process. You will not scale that. Gate before value moves. Caps sealed. Mandate is a number. `/verify/{id}` is the audit link. Fail closed on 503. You keep policy, keys, agent, customer.
- **Agent workflow:** the tool call before the tool call that cannot be undone. Map the ask → 402 → pay → ALLOW|HOLD|DENY|REVIEW → then the real tool. No API key. No login. Idempotency. Receipt id on the trace. Do not put Hop on every token.

Canonical copy: [`language.md`](language.md).

## Runtime path

```text
Caller (UI, MCP client, or external agent)
        │
        │  POST /v1/query
        ▼
Hop API ── HTTP 402 PaymentRequirements
        │     scheme: exact
        │     network: hedera:testnet
        │     asset: "0.0.0"          # HBAR, tinybars
        │     extra.feePayer          # from GET {facilitator}/supported
        │
        │  retry with X-PAYMENT + Idempotency-Key
        ▼
Blocky402  /verify  then  /settle
        ▼
CRE handlerInTee  (HTTP trigger, AWS Nitro us-west-2)
        │  1. runtime.getSecret({ id: "POLICY_TABLE" })
        │  2. runtime.getSecret({ id: "GRAPH_API_KEY" })
        │  3. live Messari Lending/CDP 3.1.0 HTTP via HTTPClient + TeeRuntime
        │  4. join + sanitize
        │  5. runtime.usingTheDons().report(commitment)
        ▼
HTTP 200  { status, aggregate, evidence }
        │
        └── optional HCS submit of commitment hashes
```

## Trust boundary

| Inside the confidential handler | Leaves the handler |
| --- | --- |
| Policy table (caps, operators, values) | Policy version and SHA-256 of the table |
| Graph API key | Subgraph IDs, `schemaVersion`, `methodologyVersion`, block, block timestamp |
| Account rows used for k-anonymous bins | Bin counts only; `accounts_considered: "omitted"` |
| Raw Graph JSON | Sanitized aggregate; metric names hashed |

The workflow source and WASM binary are visible to the DON. Local `cre workflow simulate` is not a hardware TEE. Production secret custody requires Vault DON secrets on a deployed workflow.

## Identifiers

The Graph documentation distinguishes three identifiers. Hop records the **Subgraph ID** used on the Gateway (`/subgraphs/id/{id}`).

| Term | Shape | Hop field |
| --- | --- | --- |
| Subgraph ID | base58, Gateway `/subgraphs/id/{id}` | `graph.deployments[].subgraphId` |
| Deployment | `_meta.deployment` (IPFS / deployment id) | `graph.deployments[].deploymentId` |
| Schema version | Messari Lending/CDP compatibility | `schemaVersion` (`3.1.0`) |
| Methodology version | metric calculation version | `methodologyVersion` |

`id` on the evidence deployment object is a legacy alias of `subgraphId`.

## Networks and assets

| Rail | Network | Asset |
| --- | --- | --- |
| Settlement | `hedera:testnet` | HBAR token id `0.0.0`, or an HTS token id via `HEDERA_ASSET` |
| Protocol data | Ethereum mainnet (indexed) | Messari standardized lending subgraphs |
| Confidential compute | CRE simulator or CRE network | N/A |

## References

- [Hedera and the x402 payment standard](https://hedera.com/blog/hedera-and-the-x402-payment-standard/)
- [Blocky402](https://blocky402.com/)
- [x402 protocol](https://github.com/x402-foundation/x402)
- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
- [MCP authorization (OAuth is not on `/v1/query`)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [Standardized Subgraphs](https://thegraph.com/docs/en/subgraphs/existing-subgraphs/standard-subgraphs/)
- [Messari lending schema](https://github.com/messari/subgraphs/blob/master/schema-lending.graphql)
- [Subgraph Studio API keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
- [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/)
- [Confidential Workflows in CRE](https://docs.chain.link/cre/concepts/confidential-workflows)
- [Making a workflow confidential (TypeScript)](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts)
