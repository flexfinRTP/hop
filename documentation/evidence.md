# Evidence

Every settled hop writes a public evidence pack. Packs contain hashes, Graph provenance, settlement references, and optional HCS sequence numbers. They do not contain policy caps, account ids, or Graph API keys.

Enterprise audit gets this pack as a link (`/verify/{id}`), not a screenshot of a chat. The receipt names what was not verified. Why: [`language.md`](language.md).

## HTTP

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/v1/evidence?limit=50` | Newest-first list |
| `GET` | `/v1/evidence/{id}` | Pack |
| `GET` | `/v1/evidence/{id}/peac` | PEAC-shaped portable receipt |
| `GET` | `/v1/evidence/{id}/verify` | Recomputed checks |

## Pack fields

```json
{
  "id": "uuid",
  "timestamp": "2026-09-12T18:00:00.000Z",
  "query": { "type": "policy_check", "params": { "protocols": ["aave-v3", "compound-v3"] } },
  "graph": {
    "deployments": [
      {
        "id": "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
        "subgraphId": "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
        "slug": "aave-v3-ethereum",
        "schemaVersion": "3.1.0",
        "methodologyVersion": "1.0.0",
        "block": 23000000,
        "blockTimestamp": 1710000000
      }
    ]
  },
  "policy": { "version": "1", "threshold_hash": "sha256" },
  "k_anon": { "result": "not_applicable" },
  "aggregate_hash": "sha256",
  "settlement": { "ref": "0.0.x@seconds.nanos" },
  "cre": {
    "mode": "simulation",
    "artifact": "handlerInTee",
    "tee": "nitro:us-west-2",
    "trigger": "http",
    "cre_commitment_hash": "sha256"
  },
  "meter": { "amount": "110000", "protocols": 2 },
  "hcs_seq": 12,
  "chain": { "prev": "sha256", "hash": "sha256" },
  "peac_hash": "sha256",
  "status": "accept",
  "verdict": "ALLOW",
  "reason_code": "policy_clear",
  "screening": { "ofac": "not_screened", "kyc": "not_performed", "world": "off" },
  "identity": {
    "passport_id": "optional",
    "did": "did:web:… optional",
    "erc8004": { "agent_id": "optional", "agent_registry": "optional" }
  }
}
```

`GET /v1/evidence/{id}/verify` recomputes aggregate hash, chain link, predecessor, PEAC hash, and CRE commitment shape. It also checks Hedera Mirror Node for settlement (payer, payee, amount, SUCCESS) and, when `hcs_seq` is present, the HCS topic/sequence/payload. Results cache ~60s; pass `?refresh=1` to re-query Mirror Node. Public HTML: `GET /verify/{id}` (`receipt.verify_path`).

`ok` today means: local hashes match **and** public settlement (and HCS, if anchored) check out **and** CRE fields are structurally valid. `cre_ok` is **not** DON-authoritative proof by itself. `cre.mode` stays `"simulation"` until a DON execution is retrieved and the commitment hash matches. `external_settlement_verified` / `external_hcs_verified` are live Mirror Node checks as of 0.0.62.

`GET /v1/evidence/{id}/verify` also returns `tiers` and meaning labels:

```json
{
  "ok": true,
  "ok_means": "local_hashes_and_public_settlement",
  "cre_ok_means": "structural_simulation_fields",
  "hcs_present": true,
  "tiers": {
    "recomputed": true,
    "settlement_confirmed": true,
    "hcs_confirmed": true,
    "cre_simulation": true,
    "cre_don_verified": false
  }
}
```

`cre_don_verified` is true only when `cre.mode` is `don` after a commitment match. `/app` shows HASHES / SETTLEMENT / HCS / CRE SIM / DON. DON is green only when that tier is true.

`POST /v1/query` 200 includes `receipt` (`hop.decision.v1`) built from the same evidence pack. Verify also returns that receipt. `receipt.verification` is omitted on the hot query path; agents call `/verify` or open `/verify/{id}`. Receipt fields: `decision.verdict` (`ALLOW`/`HOLD`/`DENY`/`REVIEW`), `reason_code`, `screening`, `payment.rail=hedera_x402_exact`, `verify_path`, optional `identity.did` / `identity.erc8004` / `identity.passport_id`. DID is syntax-checked only. Public query is x402, not OAuth.

## HCS

When `HOP_HCS_AUTO=1` (or `HEDERA_HCS_TOPIC` is set) and operator keys exist, the API creates or reuses a testnet topic and submits:

- evidence id
- aggregate hash
- settlement ref
- mandate hash
- chain hash
- policy hash
- CRE commitment hash (`cre_commitment_hash`; `report_hash` is historical)
- World nullifier hash (if present)

This is a commitment log, not a full replay of Graph rows.

## PEAC

`GET /v1/evidence/{id}/peac` returns a portable receipt (`peac-shaped/hop-0.1`): payment, Graph provenance, result hashes, mandate hash. It is Hop’s PEAC-shaped export, not a claim of a third-party PEAC registry.

## Posture

| Label | Value |
| --- | --- |
| Custody | Non-custodial. Caller wallet signs. Facilitator settles. |
| Screening | OFAC not screened |
| Merchant of record | Testnet payee |
| ATS | Testnet bond lifecycle via SDK 8.0.0. No investment rights. Verified only after Mirror success |
| CRE | `simulation` until a verified DON result is stored |

Retention default: `HOP_EVIDENCE_TTL_MS` (72h). Evidence files under `data/` are local runtime artifacts and are not committed.
