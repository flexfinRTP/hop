# Operator activation

Code is complete through **0.0.67**. These steps are the only remaining work that requires your machine, wallet, or camera.

Do them in order. Restart the API after env changes.

## Already confirmed on this machine

| Check | Value |
| --- | --- |
| Graph Aave | live HTTP 200 |
| Blocky402 | `feePayer` `0.0.7162784` |
| Merchant | `0.0.10490506` |
| Demo payer | `0.0.10490510` |
| `HOP_DEMO_SIGN` | `1` |
| `HOP_JOIN` | `cre` |
| Policy table | both books `gt 0.78` |
| `HOP_POLICY_COMMITMENT_SALT` | written to root `.env` and `cre/.env` |
| CRE CLI | `C:\Users\gaffn\AppData\Local\Programs\cre\cre.exe` v1.33.0 |

## 1. CRE login (required for Hedera + Graph + Chainlink tape)

PowerShell:

```powershell
& "$env:LOCALAPPDATA\Programs\cre\cre.exe" login
& "$env:LOCALAPPDATA\Programs\cre\cre.exe" whoami
```

`whoami` must succeed. If you use a key instead of browser login, put `CRE_API_KEY=` in root `.env` and `cre/.env` (same value). Do not commit it.

Optional, so the API does not search PATH:

```
CRE_CLI=C:\Users\gaffn\AppData\Local\Programs\cre\cre.exe
```

## 2. Restart API

In the API terminal:

```powershell
# Ctrl+C, then
cd C:\Appdev\etho26
npm run dev:api
```

Web can stay up (`npm run dev:web` → http://localhost:5173).

Confirm:

```powershell
node --input-type=module -e "const r=await fetch('http://127.0.0.1:8787/health'); console.log(await r.text());"
```

Unpaid query must return **402**, not 503.

## 3. Paid hop (Hedera x402 + Graph + CRE)

http://localhost:5173/app

1. Query `policy_check`, protocols Aave + Compound.
2. Run unpaid → 402.
3. Pay (demo signer is on).
4. Wait for 200.
5. Click **VERIFY HASHES**. Expect HASHES / SETTLEMENT / CRE SIM. DON stays `—`.
6. Open **HASHSCAN**. Save:
   - HashScan URL
   - evidence id
   - both `subgraphId` + `schemaVersion` + `methodologyVersion` + blocks
   - HCS topic/seq if present
   - `cre_commitment_hash`

That one receipt is the Hedera floor, Graph standardized + AI demo source, and Chainlink sim tape.

## 4. Graph AI path (same hop)

In Cursor, with Hop MCP + `skills/hop-query/SKILL.md`: ask for a policy check. Show NL → `hop_meta` / `hop_pay` → decision, not raw GraphQL.

## 5. ATS (Hedera tokenization)

1. After step 3 has an **accept** evidence pack.
2. Open http://localhost:5173/assets
3. MetaMask on Hedera testnet (chain id **296**).
4. Create intent → CONNECT + EXECUTE.
5. Optional: INTERNAL KYC only if you have a real Base64 VC.
6. Save HashScan links for factory / roles / issue / lock.

Factory/resolver defaults (do not use v4 addresses):

```
ATS_FACTORY_ADDRESS=0.0.9213391
ATS_RESOLVER_ADDRESS=0.0.9212226
ATS_BOND_CONFIG_ID=0x0000000000000000000000000000000000000000000000000000000000000002
```

## 6. Sepolia liquidation (Chainlink extra)

```
LIQUIDATION_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
LIQUIDATION_EXECUTOR_PRIVATE_KEY=0x...   # wallet that will join(); keep local
LIQUIDATION_PARTICIPANT_ADDRESS=0x...    # same wallet, unchecked address
```

```powershell
npx tsx cre/liquidation-protection/join.ts
cd cre
& "$env:LOCALAPPDATA\Programs\cre\cre.exe" workflow simulate liquidation-protection --target staging-settings --non-interactive --trigger-index 0
```

Official contracts (already in code):

```
ChallengeLending  0x88574e7Cc0027afd04951daa09B64d4441931ba1
vETH              0x5dED1a40c3D56dA42E7f932f781c0432556c9814
vUSD              0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2
```

## 7. Video (you)

ETHGlobal upload: **2–4 min**, ≥720p, no TTS.

| Time | Show |
| --- | --- |
| 0:00 | One paid confidential policy check over two live lending books |
| 0:20 | Unpaid 402: `hedera:testnet` `0.0.0` `feePayer` |
| 0:50 | Pay → HashScan |
| 1:20 | CRE terminal: Nitro `us-west-2` + “simulator is not a real TEE” |
| 2:00 | Same GraphQL on Aave + Compound, schema 3.1.0, decision |
| 2:40 | MCP/SKILL |
| 3:10 | Evidence vault chips + HCS |
| 3:40 | `/assets` if you ran ATS |

## Do not

- Do not set `cre.mode` to `don` from a trigger ACK.
- Do not use Graph Base USDC x402 as the Hedera rail.
- Do not invent an Agent0 Hedera subgraph id (not deployed).
- Do not commit `.env`.
