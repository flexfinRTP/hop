# Operator activation

**Sunset 0.1.0.** These steps run the archive. They are not remaining product work. Judges: [`judge.md`](judge.md). Why enterprise / why agent: [`language.md`](language.md).

Do them in order. Restart the API after env changes.

## Confirm locally (do not commit machine paths or keys)

| Check | Expect |
| --- | --- |
| Graph Aave | live HTTP 200 |
| Blocky402 | reachable `feePayer` |
| Merchant / demo payer | funded Hedera testnet accounts from `setup:local` |
| `HOP_DEMO_SIGN` | `1` for the desk demo signer |
| `HOP_JOIN` | `cre` |
| Policy table | both books `gt 0.78` |
| `HOP_POLICY_COMMITMENT_SALT` | set in root `.env` and `cre/.env` (local only) |
| CRE CLI | on PATH as `cre`, or set `CRE_CLI` locally |
| `HOP_PASSPORT_SECRET` | 32-byte hex if you will issue passports; empty = identity routes 503 |

## 1. CRE login (required for Hedera + Graph + Chainlink tape)

PowerShell:

```powershell
cre login
cre whoami
```

If `cre` is not on PATH, invoke the installer location via `$env:LOCALAPPDATA\Programs\cre\cre.exe`. Do not commit that path.

`whoami` must succeed. If you use a key instead of browser login, put `CRE_API_KEY=` in root `.env` and `cre/.env` (same value). Do not commit it.

Optional local override (empty in `.env.example`; API auto-discovers):

```
CRE_CLI=
```

## 2. Restart API

From the repo root:

```powershell
# Ctrl+C in the API terminal, then
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
5. Click **VERIFY HASHES**. Expect HASHES / SETTLEMENT / CRE SIM. HCS SKIP unless topic/seq present. DON stays `—`.
6. Confirm AGENT BUDGET remaining dropped. Verdict `ALLOW` or `HOLD`. Screening `OFAC not_screened`.
7. **VERIFY LINK** → `/verify/{id}`. Copy link. Open **HASHSCAN**. Save:
   - HashScan URL
   - evidence id
   - both `subgraphId` + `schemaVersion` + `methodologyVersion` + blocks
   - HCS topic/seq if present
   - `cre_commitment_hash`
8. Optional: Infrastructure → ISSUE passport → paste `X-Hop-Passport` → hop again so receipt `identity` is set. Optional `X-Hop-Did` stamps `identity.did` without login.
9. Optional: one REVIEW/DENY (human threshold or passport_bound mandate) so remaining + `consumer_prompt` show.

That one receipt is the Hedera floor, Graph standardized + AI demo source, Chainlink sim tape, and identity/verify surface.

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
| 2:40 | MCP/SKILL · `/docs/judge` |
| 3:10 | Evidence vault chips + `/verify/{id}` + HCS |
| 3:40 | `/assets` if you ran ATS |

## Hosted demo (two Vercel projects, same git repo)

Do not point one project at `apps/api` as a Vite app. Vercel monorepo = **two projects**, one import each.

**Project hop (UI)**

| Field | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `apps/web` |
| Include files outside Root Directory | On |
| Install | from `apps/web/vercel.json` (`cd ../.. && npm install`) |
| Build | from `apps/web/vercel.json` (`npm run build -w @hop/web`) |
| Output | `dist` |
| Node | 20.x |

Local: `npm run build` at the repo root typechecks `@hop/api` then builds `@hop/web`.

**Project hop-api (API)**

| Field | Value |
| --- | --- |
| Framework Preset | Hono (Other if Hono is missing) |
| Root Directory | `apps/api` |
| Include files outside Root Directory | On |
| Install | from `apps/api/vercel.json` (`cd ../.. && npm install`) |
| Build | from `apps/api/vercel.json` (`npm run build -w @hop/api`) |
| Node | 20.x |

`.vercelignore` keeps `cre/`, `apps/mcp`, and `apps/harness` out of both Vercel uploads. hop-api typecheck is `apps/api/src` only.

After both URLs exist, open the **hop** (Vite) project — not hop-api. Same GitHub repo. Then **CDN → Routing Rules → Add Rule**. Action = **Rewrite**. Publish when all three are saved.

```
If path is /v1/:path*           rewrite to  https://<hop-api>.vercel.app/v1/:path*
If path is /health              rewrite to  https://<hop-api>.vercel.app/health
If path is /.well-known/:path*  rewrite to  https://<hop-api>.vercel.app/.well-known/:path*
```

On **hop-api** env: copy root `.env`, then set `HOP_JOIN=inline`, `HOP_DEMO_SIGN=1`, `HOP_CORS_ORIGIN=https://<hop>.vercel.app`, `HOP_PUBLIC_BASE_URL=https://<hop-api>.vercel.app`, `DATABASE_URL` (Neon/Supabase), `DATABASE_SSL=1`. CRE CLI does not run on Vercel.

## Do not

- Do not set `cre.mode` to `don` from a trigger ACK.
- Do not use Graph Base USDC x402 as the Hedera rail.
- Do not invent an Agent0 Hedera subgraph id (not deployed).
- Do not commit `.env`.
