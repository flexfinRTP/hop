/**
 * Local test bootstrap. Writes gitignored .env files.
 * Never prints private keys.
 *
 * Usage: node scripts/bootstrap-local.mjs
 * Then fund the two EVM addresses at the Hedera faucet and run:
 *   node scripts/resolve-hedera-accounts.mjs
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivateKey } from "@hashgraph/sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const creEnvPath = resolve(root, "cre", ".env");
const publicPath = resolve(root, "data", "local-wallets.public.json");

const POLICY =
  '{"version":"week-1","k":5,"caps":[{"metric":"utilization","op":"gt","value":0.78,"scope":"all"}]}';

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

function existing(path) {
  if (!existsSync(path)) return {};
  return parseEnv(readFileSync(path, "utf8"));
}

function evmOf(key) {
  const addr = key.publicKey.toEvmAddress();
  return addr.startsWith("0x") ? addr : `0x${addr}`;
}

function hexKey(key) {
  const raw = key.toStringRaw();
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

const prev = existing(envPath);
const prevCre = existing(creEnvPath);

const merchantKey = prev.HEDERA_OPERATOR_KEY
  ? PrivateKey.fromStringECDSA(prev.HEDERA_OPERATOR_KEY)
  : PrivateKey.generateECDSA();
const payerKey = prev.HEDERA_DEMO_PRIVATE_KEY
  ? PrivateKey.fromStringECDSA(prev.HEDERA_DEMO_PRIVATE_KEY)
  : PrivateKey.generateECDSA();

const merchantEvm = evmOf(merchantKey);
const payerEvm = evmOf(payerKey);
const merchantHex = hexKey(merchantKey);
const payerHex = hexKey(payerKey);
const creEth =
  prevCre.CRE_ETH_PRIVATE_KEY || prev.CRE_ETH_PRIVATE_KEY || randomBytes(32).toString("hex");

const graphKey = (prev.GRAPH_API_KEY || process.env.GRAPH_API_KEY || "").trim();

const envBody = `# Hop local test env — never commit
PORT=8787

BLOCKY402_FACILITATOR_URL=https://api.testnet.blocky402.com
HEDERA_NETWORK=hedera:testnet
HEDERA_ASSET=0.0.0
HEDERA_PAY_TO=${prev.HEDERA_PAY_TO || ""}
HOP_PRICE_TINYBARS=100000

GRAPH_API_KEY=${graphKey}
GRAPH_GATEWAY=https://gateway.thegraph.com/api/subgraphs/id
GRAPH_PROTOCOL_A_ID=JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk
GRAPH_PROTOCOL_A_URL=
GRAPH_PROTOCOL_B_ID=AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9
GRAPH_PROTOCOL_B_URL=
CHAIN_RPC_URL=https://ethereum-rpc.publicnode.com

HOP_POLICY_TABLE_JSON=${POLICY}

PAYER_ALLOWLIST=${prev.PAYER_ALLOWLIST || ""}
QUERY_RATE_LIMIT_PER_MIN=6

HOP_JOIN=cre
CRE_CWD=${resolve(root, "cre").replaceAll("\\", "/")}
CRE_ETH_PRIVATE_KEY=${creEth}
CRE_WORKFLOW_ID=${prev.CRE_WORKFLOW_ID || ""}
CRE_GATEWAY_URL=${prev.CRE_GATEWAY_URL || "https://01.enterprise-gateway.zone-a.cre.chain.link/"}

HOP_DEMO_SIGN=1
HEDERA_DEMO_ACCOUNT_ID=${prev.HEDERA_DEMO_ACCOUNT_ID || ""}
HEDERA_DEMO_PRIVATE_KEY=${payerHex}

HEDERA_HCS_TOPIC=${prev.HEDERA_HCS_TOPIC || ""}
HEDERA_OPERATOR_ID=${prev.HEDERA_OPERATOR_ID || ""}
HEDERA_OPERATOR_KEY=${merchantHex}

HOP_CORS_ORIGIN=http://localhost:5173
WALL_BUFFER=0.2
HOP_EVIDENCE_DIR=
HOP_EVIDENCE_TTL_MS=259200000
HOP_API_URL=http://localhost:8787

WORLD_APP_ID=${prev.WORLD_APP_ID || ""}
WORLD_RP_ID=${prev.WORLD_RP_ID || ""}
WORLD_RP_SIGNING_KEY=${prev.WORLD_RP_SIGNING_KEY || ""}
WORLD_ACTION=${prev.WORLD_ACTION || "hop-query"}
WORLD_ENVIRONMENT=${prev.WORLD_ENVIRONMENT || "staging"}
WORLD_REQUIRED=${prev.WORLD_REQUIRED || "0"}

# Public aliases (not secret). Fund these, then run resolve-hedera-accounts.mjs
HEDERA_MERCHANT_EVM=${merchantEvm}
HEDERA_PAYER_EVM=${payerEvm}
`;

const creBody = `# CRE simulator — never commit
CRE_ETH_PRIVATE_KEY=${creEth}
HOP_POLICY_TABLE_JSON=${POLICY}
GRAPH_API_KEY=${graphKey}
`;

writeFileSync(envPath, envBody, { encoding: "utf8", mode: 0o600 });
writeFileSync(creEnvPath, creBody, { encoding: "utf8", mode: 0o600 });

const pub = {
  merchant_evm: merchantEvm,
  payer_evm: payerEvm,
  faucet: "https://portal.hedera.com/?network=testnet",
  faucet_alt: "https://docs.hedera.com/learn/getting-started/testnet-faucet",
  graph_studio_keys: "https://thegraph.com/studio/apikeys/",
  graph_ready: Boolean(graphKey),
  hedera_pay_to: prev.HEDERA_PAY_TO || null,
  hedera_demo_account: prev.HEDERA_DEMO_ACCOUNT_ID || null,
};
mkdirSync(resolve(root, "data"), { recursive: true });
writeFileSync(publicPath, JSON.stringify(pub, null, 2), "utf8");

process.stdout.write(
  [
    "Wrote .env and cre/.env (private keys stay in those files).",
    `Merchant EVM (payee): ${merchantEvm}`,
    `Payer EVM (workbench): ${payerEvm}`,
    `Graph API key in env: ${graphKey ? "yes" : "NO — you must paste one"}`,
    `Hedera account ids: ${prev.HEDERA_PAY_TO && prev.HEDERA_DEMO_ACCOUNT_ID ? "already set" : "not yet — fund faucet then resolve"}`,
    "Faucet: https://portal.hedera.com/?network=testnet",
    "Graph key: https://thegraph.com/studio/apikeys/",
    "After both faucet drops land: node scripts/resolve-hedera-accounts.mjs",
    "",
  ].join("\n"),
);
