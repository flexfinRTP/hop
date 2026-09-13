# Hedera Lifecycle Harness

**Sunset 0.1.0.** Extra track. Archive.

Declarative, read-only evidence validator for Hedera testnet transactions, contract results, HCS messages, and Asset Tokenization Studio lifecycles.

The ATS validator requires five distinct successful contract transactions:

1. factory creation
2. role assignment
3. compliance control
4. issuance
5. lifecycle action

Each transaction and contract result is resolved from Hedera Mirror Node. The resulting JSON is suitable for a demo evidence bundle or CI artifact.

## Run

Set the environment variables referenced by `examples/ats-lifecycle.yaml`, then:

```bash
npm start -w @hop/hedera-lifecycle-harness -- examples/ats-lifecycle.yaml --out ats-evidence.json
```

No private key is accepted or required. The harness validates existing transactions; the official ATS SDK or web application remains responsible for wallet-authorized mutations.

## Recipe steps

- `hedera_transaction`: receipt result and exact HBAR/HTS transfers.
- `contract_result`: transaction status, contract target, and empty/non-empty EVM error.
- `hcs_message`: topic, sequence, and recursive JSON payload subset.
- `ats_lifecycle`: asset contract plus mandatory factory/roles/compliance/issue/lifecycle stages.

Environment interpolation is limited to `${UPPER_CASE_NAMES}` and fails closed when a value is missing. Mirror Node defaults to the official Hedera testnet endpoint and can be overridden per recipe.

This package is an independent harness inspired by the Hedera Harness recipe model. It does not claim to be an upstream contribution until a public repository or PR is published.
