# Chainlink CRE confidential workflow

**Sunset 0.1.0.** Archive.

Hop’s join runs as a CRE Confidential Workflow. TypeScript `handlerInTee` executes on AWS Nitro (`us-west-2`). Secrets and Graph HTTP occur inside the enclave. `usingTheDons().report()` publishes a commitment, not the policy table or raw Graph payloads.

Enterprise: policy caps stay sealed. That is why the limit is not in a prompt. Agent: 503 before settle if CRE is down — do not act on a ghost. Why: [`language.md`](language.md).

Official: [CRE](https://docs.chain.link/cre), [Confidential Workflows](https://docs.chain.link/cre/concepts/confidential-workflows), [TypeScript guide](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts), [HTTP capability](https://docs.chain.link/cre/capabilities/http), [Hello Confidential Workflows](https://docs.chain.link/cre-templates/hello-confidential-workflows).

Hop is not the [AI audit firewall](https://docs.chain.link/cre-templates/ai-audit-firewall) template and not the [automated liquidation protection](https://docs.chain.link/cre-templates/automated-liquidation-protection) template. Those are separate products.

## Handler

`cre/hop-query/main.ts`:

```ts
return [handlerInTee(trigger, onQuery, [{ tee: "nitro", regions: ["us-west-2"] }])];
```

Inside `onQuery`:

1. `runtime.getSecret({ id: "POLICY_TABLE" })` — empty table → `{ error: "policy_unavailable" }`.
2. `runtime.getSecret({ id: "GRAPH_API_KEY" })` unless the runtime config already carries a header.
3. `HTTPClient.sendRequest` with `TeeRuntime` against each requested Messari subgraph (and chain-head RPC).
4. `joinAndAggregate` + `sanitizeAggregate`.
5. `runtime.usingTheDons().report({ encodedPayload, encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" })`.
6. Return status, sanitized aggregate, Graph metadata, and `cre_commitment_hash`.

`cre_commitment_hash` is SHA-256 of the JSON commitment Hop passed to `report()`. It is not a Chainlink-signed report identifier. Historical packs may still carry `report_hash`.

Use the regular `HTTPClient` TEE overload from `handlerInTee`. Do not call `ConfidentialHTTPClient` from this handler.

## Secrets

`cre/secrets.yaml`:

```yaml
POLICY_TABLE:
  - HOP_POLICY_TABLE_JSON
GRAPH_API_KEY:
  - GRAPH_API_KEY
```

| Mode | Secret source |
| --- | --- |
| `cre workflow simulate` | Process environment / `--env` file |
| Deployed workflow | Vault DON (`cre secrets create`). Browser auth on private registry. |

The API preflights `HOP_POLICY_TABLE_JSON` before issuing a 402 so an empty table is not charged. Local simulation injects that string into the CRE CLI process environment (`join-run.ts`). Exclusive enclave custody of the secret requires a deployed workflow with Vault DON secrets. Hop does not claim exclusive TEE custody.

## Simulation vs DON trigger vs DON-verified

| State | How it is produced | `cre.mode` | `tiers.cre_don_verified` |
| --- | --- | --- | --- |
| Simulation | `cre workflow simulate hop-query` | `simulation` | false |
| DON trigger | `workflows.execute` returns `ACCEPTED` + `workflow_execution_id` | `simulation` | false |
| DON-verified | `cre execution status` is `SUCCESS` **and** retrieved `cre_commitment_hash` matches the simulation commitment | `don` | true |

A trigger ACK is not a DON result. If retrieve fails or the commitment is absent/unmatched, the product result stays the simulation aggregate with `mode: simulation` and the execution id recorded.

## Simulation

CLI simulation is a valid confidential-workflow demonstration. It performs live HTTP. It is not a hardware TEE.

```bash
cd cre
cp .env.example .env
# CRE_ETH_PRIVATE_KEY, HOP_POLICY_TABLE_JSON, GRAPH_API_KEY
cre workflow simulate hop-query \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --http-payload @hop-query/http-payload.json \
  --env ./.env
```

API-triggered runs use `--target api-settings` and a generated payload. They are serialized per process.

Expected simulator output includes:

```text
Trigger requested TEE Execution
  - AWS Nitro in us-west-2
The simulator is not a real TEE
Do not use it for sensitive information
✓ Workflow Simulation Result
```

`HOP_JOIN=cre` with a missing or unauthenticated CLI returns `503 cre_unavailable` before settlement. Authenticate the CRE CLI (`cre login` / `CRE_API_KEY`) for that path.

## HTTP trigger authorization

`http.trigger({})` is valid for simulation. A deployed HTTP trigger must set `authorizedKeys` (EVM key). Hop writes `authorized_evm_address` into generated runtime config when `CRE_WORKFLOW_ID` is set. Production `config.production.json` must include the same field before a live deploy is claimed.

## Production deploy (optional)

```bash
cre workflow deploy hop-query --target production-settings
cre secrets create production-secrets.yaml --target production-settings --secrets-auth=browser
cre workflow list
```

Until the live execution result is retrieved and the commitment hash matches, evidence stays `cre.mode: "simulation"`.

## Confidentiality claims that are true

- Policy table is processed inside `handlerInTee`.
- Graph responses used for the join are fetched from `TeeRuntime`.
- Caps, account ids, and metric names do not appear on the public aggregate.
- Commitment to the DON is hashes + Graph identifiers + status + k-anon.

## Confidentiality claims that are false

- The WASM binary is confidential.
- Local simulation is AWS Nitro.
- `CRE_WORKFLOW_ID` alone converts a simulator aggregate into a DON result.
- Hop “attests” the policy the way a hardware quote attests firmware.
