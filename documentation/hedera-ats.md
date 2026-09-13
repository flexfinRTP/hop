# Hedera Asset Tokenization Studio

Hop issues and manages a testnet private-credit bond through the official `@hashgraph/asset-tokenization-sdk` **8.0.0**. The API never holds an ATS wallet key. The browser wallet signs every mutation. Mirror Node verifies consensus before an intent is marked `verified`.

Official sources: [ATS monorepo](https://github.com/hashgraph/asset-tokenization-studio), [SDK 8.0.0](https://www.npmjs.com/package/@hashgraph/asset-tokenization-sdk), [v8 testnet deployment JSON](https://github.com/hashgraph/asset-tokenization-studio/blob/main/packages/ats/contracts/deployments/hedera-testnet/newBlr-2026-06-12T11-19-42-198.json).

Do not use the stale v4 addresses from older SDK guides (`0.0.7707874` / `0.0.7708432`).

## Published testnet v8 addresses

| Role | Hedera ID | EVM |
| --- | --- | --- |
| Factory proxy | `0.0.9213391` | `0xd1F118A40f3b02883D35909eF2517e7EDd78379d` |
| Resolver / BLR proxy | `0.0.9212226` | `0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a` |

Bond configuration id:

```text
0x0000000000000000000000000000000000000000000000000000000000000002
```

The browser client calls `Management.resolveLatestConfigVersion` after `Network.init`. It does not invent a version.

## HTTP

```http
GET  /v1/assets/config
GET  /v1/assets
POST /v1/assets/intents
POST /v1/assets/intents/{id}/transactions
GET  /v1/assets/intents/{id}
```

`POST /intents` requires an accepted Hop evidence pack whose Hedera x402 settlement has already been Mirror-verified. Follow-on actions (`coupon`, `redeem`, `pause`, `unpause`) require a verified parent intent and its asset contract.

## Wallet lifecycle

Workspace: `/assets`.

1. `Network.init` + `Network.connect(SupportedWallets.METAMASK)`
2. Resolve latest bond config version
3. `Bond.create(CreateBondRequest)`
4. `Role.applyRoles` — issuer, control list, locker, corporate actions, pauser, freeze manager, maturity redeemer, optional KYC
5. `Security.addToControlList` for issuer and recipient
6. Optional `Kyc.activateInternalKyc` + `Kyc.grantKyc` with a caller-supplied Base64 VC (no fabricated credential)
7. `Security.issue`
8. `Security.transferAndLock` to maturity
9. Optional `Coupon.setCoupon` when `coupon_rate_bps > 0`

Follow-on: `Coupon.setCoupon`, `Security.pause` / `unpause`, `Bond.fullRedeemAtMaturity`.

## Verification

`apps/api/src/ats-verifier.ts` and `@hop/hedera-lifecycle-harness` poll Mirror Node with bounded backoff:

```text
GET /api/v1/transactions/{id}
GET /api/v1/contracts/results/{id}
GET /api/v1/contracts/{asset}
```

A factory stage must produce `created_contract_ids`. Mutation stages must succeed without `error_message`. Verified hashes are anchored on HCS as `hop.ats-lifecycle.v1`.

The instrument is Hedera testnet only. It confers no investment rights.
