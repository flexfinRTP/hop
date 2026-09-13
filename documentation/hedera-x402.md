# Hedera x402

**Sunset 0.1.0.** Archive.

Hop is an x402 resource server. Settlement is Hedera `exact` through [Blocky402](https://blocky402.com/). Clients must use the Hedera scheme, not a generic EVM/USDC `fetchWithPayment` helper and not The Graph’s Base USDC x402 Gateway. Public `POST /v1/query` is x402, not OAuth (`GET /.well-known/oauth-protected-resource`, `oauth_on_query: false`). No API key. No login wall.

Agent workflow: unpaid POST returns 402; retry with `X-PAYMENT` + `Idempotency-Key`. That is why Hop fits an agent loop — not a portal. Enterprise: public HashScan is the spend record. Why: [`language.md`](language.md).

Official background: [Hedera and the x402 payment standard](https://hedera.com/blog/hedera-and-the-x402-payment-standard/), [x402 protocol](https://github.com/x402-foundation/x402), [`@x402/hedera`](https://github.com/x402-foundation/x402).

## Facilitator

| Environment | Base URL |
| --- | --- |
| Testnet (default) | `https://api.testnet.blocky402.com` |
| Mainnet | `https://api.blocky402.com` |

Hop’s configured network is `hedera:testnet`.

```http
GET /supported
```

Read the Hedera `exact` kind at runtime. Do not hardcode `feePayer`.

```ts
const json = await fetch("https://api.testnet.blocky402.com/supported").then((r) => r.json());
const kind = json.kinds.find((k) => k.network === "hedera:testnet");
const feePayer = kind.extra.feePayer; // or json.signers["hedera:*"][0]
```

Observed testnet shape (subject to change; `/supported` is authoritative):

```json
{
  "kinds": [
    {
      "scheme": "exact",
      "network": "hedera:testnet",
      "x402Version": 2,
      "extra": { "feePayer": "0.0.7162784" }
    }
  ]
}
```

## PaymentRequirements

Unpaid `POST /v1/query` returns HTTP 402:

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "hedera:testnet",
      "amount": "110000",
      "payTo": "0.0.xxxxxxxx",
      "maxTimeoutSeconds": 60,
      "asset": "0.0.0",
      "extra": { "feePayer": "0.0.7162784" }
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `scheme` | `exact` only |
| `network` | `hedera:testnet` |
| `asset` | `"0.0.0"` for HBAR (tinybars). HTS uses the token id; payer must associate. |
| `amount` | Exact transfer. Facilitator must not be a net sender. |
| `payTo` | Merchant account (`HEDERA_PAY_TO`) |
| `extra.feePayer` | Facilitator account that sponsors network fees. Client sets this account as transaction payer and signs a partial `TransferTransaction`. |

Exact Hedera payments are direct `TransferTransaction`s. They must not be wrapped in `ScheduleCreateTransaction`.

## Client

```ts
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { createClientHederaSigner, PrivateKey } from "@x402/hedera";

const signer = createClientHederaSigner({
  accountId: process.env.HEDERA_PAYER_ID!,
  privateKey: PrivateKey.fromString(process.env.HEDERA_PAYER_KEY!),
});
const scheme = new ExactHederaScheme(signer);

const unpaid = await fetch("http://localhost:8787/v1/query", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    query: "policy_check",
    protocols: ["aave-v3", "compound-v3"],
    max_block_lag: 50,
  }),
});
if (unpaid.status !== 402) throw new Error(`expected 402, got ${unpaid.status}`);
const { accepts } = await unpaid.json();
const requirements = accepts[0];

const payload = await scheme.createPaymentPayload(2, requirements);
const paid = await fetch("http://localhost:8787/v1/query", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-PAYMENT": Buffer.from(JSON.stringify(payload)).toString("base64"),
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    query: "policy_check",
    protocols: ["aave-v3", "compound-v3"],
    max_block_lag: 50,
  }),
});
```

Workbench demo signing (`POST /v1/demo/sign`, `HOP_DEMO_SIGN=1`) uses the same scheme. It accepts only a short-lived quote previously issued by this API. Agents should sign locally and send `X-PAYMENT` themselves.

## Server

```text
1. GET facilitator /supported  → extra.feePayer
2. Quote amount (see meter)
3. Decode X-PAYMENT
4. POST /verify { x402Version, paymentPayload, paymentRequirements }
5. Mandate, allowlist, rate limit, World, CRE preflight
6. POST /settle
7. Run join
8. Persist evidence.settlement.ref  (Hedera transaction id)
```

`apps/api/src/x402.ts` implements `/supported`, `/verify`, and `/settle`. Same `Idempotency-Key` returns the original evidence id and does not settle again.

## Meter

Price is public and independent of the secret cap.

```ts
// packages/shared/src/meter.ts
amount = HOP_PRICE_TINYBARS
       + HOP_METER_TINYBARS * max(protocolCount - 1, 0)
       + floor(publicUtilization * HOP_METER_UTIL_TINYBARS)
```

| Env | Default | Meaning |
| --- | --- | --- |
| `HOP_PRICE_TINYBARS` | `100000` | Base (0.001 HBAR) |
| `HOP_METER_TINYBARS` | `10000` | Extra per additional protocol |
| `HOP_METER_UTIL_TINYBARS` | `0` | Optional public-utilization surcharge |

Two selected protocols at the defaults quote `110000` tinybars. Evidence records `meter: { amount, protocols, util }`. This is per-call metering, not a subscription and not a streaming settlement.

## Mandate

Deterministic spend control. The model cannot raise the cap or authorize payment.

```http
X-Hop-Mandate: {json or base64}
X-Hop-Confirm: 1
```

Checks: expiry, merchant `payTo`, query allowlist, freshness, per-call tinybars, total budget, velocity window, optional human threshold. Failures are HTTP 403 and are not settled.

## Discovery

```http
GET /.well-known/agent-card.json
GET /.well-known/did.json
GET /.well-known/oauth-protected-resource
GET /.well-known/agent-registration.json
```

A2A Agent Card (`securitySchemes.x402`) describing Hop’s paid skill. RFC 9728 advertises that query is **not** OAuth. Optional `X-Hop-Did` / `X-Hop-Erc8004` stamp the receipt; they are not required to pay. MCP tools remain the execution interface; the card is discovery metadata.

## Settlement proof

Transaction ids are HashScan testnet URLs:

```text
https://hashscan.io/testnet/transaction/{shard.realm.num}-{seconds}-{nanos}
```

Example (historical): https://hashscan.io/testnet/transaction/0.0.7162784-1789187260-227607013
