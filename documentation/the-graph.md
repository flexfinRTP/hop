# The Graph — standardized lending

Hop consumes **Messari Standardized Subgraphs** for Lending/CDP, schema version **3.1.0**. The same GraphQL operations run against every configured protocol. That is the intended composition: one query pattern, many protocols — not a deployed composed Subgraph (`specVersion` 1.3.0 source-subgraph indexing).

Official schema: [Standardized Subgraphs](https://thegraph.com/docs/en/subgraphs/existing-subgraphs/standard-subgraphs/), [Messari `schema-lending.graphql`](https://github.com/messari/subgraphs/blob/master/schema-lending.graphql), [SCHEMA.md](https://github.com/messari/subgraphs/blob/master/docs/SCHEMA.md).

Live data is required. Queries go to The Graph Gateway with a Subgraph Studio API key. Mock JSON, a local Graph Node, or a static fixture is not a valid data path.

## Configured sources

| Key | Protocol | Network | Subgraph ID |
| --- | --- | --- | --- |
| `aave-v3` | Aave v3 | Ethereum | `JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk` |
| `compound-v3` | Compound v3 | Ethereum | `AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9` |

Gateway URL:

```text
https://gateway.thegraph.com/api/subgraphs/id/{SUBGRAPH_ID}
Authorization: Bearer {GRAPH_API_KEY}
```

Set `GRAPH_API_KEY` in the process environment and in `cre/.env`. Confirm IDs still resolve before operating; do not ship dead IDs.

## Shared operations

`packages/shared/src/graphql.ts` is the contract. Protocol snapshot:

```graphql
query HopProtocol {
  _meta {
    deployment
    hasIndexingErrors
    block {
      number
      timestamp
    }
  }
  lendingProtocols {
    slug
    schemaVersion
    subgraphVersion
    methodologyVersion
    totalValueLockedUSD
    totalBorrowBalanceUSD
    totalDepositBalanceUSD
  }
}
```

Markets (parameter histogram + sample rate):

```graphql
query HopMarkets($skip: Int!) {
  markets(first: 200, skip: $skip) {
    id
    name
    maximumLTV
    liquidationThreshold
    totalValueLockedUSD
    totalBorrowBalanceUSD
    totalDepositBalanceUSD
    inputToken { decimals }
    inputTokenPriceUSD
    rates {
      side
      type
      rate
    }
  }
}
```

Positions and liquidations use the same Messari entities (`Position.side`, `Liquidate.amountUSD`) on every protocol.

`schemaVersion` is schema compatibility. `methodologyVersion` is the metric methodology. Unprefixed quantitative fields are spot values; daily/hourly series live on snapshot entities, which Hop does not currently pull.

## Join

```text
for protocol in requested_keys:
    snapshot[protocol] = HopProtocol + (markets | positions | liquidates as needed)
    require schemaVersion == "3.1.0"
    require methodologyVersion present
    require _meta.block.number and _meta.block.timestamp
    require hasIndexingErrors != true

utilization[protocol] = borrowUSD / depositUSD
policy_check = compare(private cap, observed utilization)   # cap stays in TEE
```

All selected sources are required. Partial success is `stale` (HTTP 200, charged) after settlement, or `graph_unconfigured` (HTTP 503, not charged) if a URL is missing before payment.

Evidence records, per source:

```json
{
  "subgraphId": "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
  "deploymentId": "Qm…",
  "slug": "aave-v3-ethereum",
  "schemaVersion": "3.1.0",
  "subgraphVersion": "…",
  "methodologyVersion": "…",
  "block": 23000000,
  "blockTimestamp": 1710000000
}
```

`subgraphId` is the Gateway query key. `deploymentId` is `_meta.deployment` when the Gateway returns it.

## What this is not

| Pattern | Hop |
| --- | --- |
| One subgraph, no standard | Out of scope |
| Official Subgraph Composition (new subgraph with subgraph data sources) | Not deployed |
| Substreams / The Graph Market streaming | Not used. Protocol state is Gateway GraphQL. |
| Graph native x402 (`/api/x402/subgraphs`, USDC on Base) | Not the payment rail |
| Authoring a new Standardized Subgraph | Out of scope |

## Agent access to Graph

Hop’s MCP/skill maps a natural-language question to a **fixed query type** and then pays Hop. It does not execute arbitrary GraphQL.

The official [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/) may run beside Hop for schema discovery. Cursor example from Graph docs:

```json
{
  "mcpServers": {
    "subgraph": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "--header",
        "Authorization:${AUTH_HEADER}",
        "https://subgraphs.mcp.thegraph.com/sse"
      ],
      "env": {
        "AUTH_HEADER": "Bearer GATEWAY_API_KEY"
      }
    },
    "hop": {
      "command": "npm",
      "args": ["start", "-w", "@hop/mcp"]
    }
  }
}
```

Use Subgraph MCP to inspect schema. Use Hop to obtain a paid, policy-bound decision. Do not treat Hop MCP as a fork of The Graph AI Suite.

## Privacy vs public data

Graph rows are public protocol state. The confidential input is the **policy table**. Callers can recompute public utilization; they cannot read Hop’s threshold. `Account.id` values used for LTV bins never appear in the aggregate (`accounts_considered: "omitted"`). Metric names in `policy_check` are replaced with `metric_hash`.
