/**
 * After you fund the two EVM addresses on the Hedera testnet faucet,
 * this maps them to 0.0.x account ids and patches .env.
 * Never prints private keys.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const publicPath = resolve(root, "data", "local-wallets.public.json");
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1/accounts";

function mustEnv() {
  if (!existsSync(envPath)) throw new Error("missing .env — run node scripts/bootstrap-local.mjs first");
  return readFileSync(envPath, "utf8");
}

function get(raw, key) {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

function set(raw, key, value) {
  const lines = raw.split(/\r?\n/);
  let found = false;
  const next = lines.map((l) => {
    if (l.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return l;
  });
  if (!found) next.push(`${key}=${value}`);
  return next.join("\n");
}

function normalizeEvm(addr) {
  const a = addr.trim().toLowerCase();
  return a.startsWith("0x") ? a : `0x${a}`;
}

async function lookup(evm) {
  const id = normalizeEvm(evm).replace(/^0x/, "");
  const url = `${MIRROR}/0x${id}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`mirror_${res.status}`);
  const json = await res.json();
  return json.account ?? null;
}

const raw0 = mustEnv();
const merchantEvm = get(raw0, "HEDERA_MERCHANT_EVM");
const payerEvm = get(raw0, "HEDERA_PAYER_EVM");
if (!merchantEvm || !payerEvm) {
  throw new Error("missing HEDERA_MERCHANT_EVM / HEDERA_PAYER_EVM — re-run bootstrap");
}

const merchantId = await lookup(merchantEvm);
const payerId = await lookup(payerEvm);

const report = {
  merchant_evm: merchantEvm,
  payer_evm: payerEvm,
  merchant_account: merchantId,
  payer_account: payerId,
};

mkdirSync(dirname(publicPath), { recursive: true });
let pub = {};
if (existsSync(publicPath)) {
  try {
    pub = JSON.parse(readFileSync(publicPath, "utf8"));
  } catch {
    pub = {};
  }
}
writeFileSync(publicPath, JSON.stringify({ ...pub, ...report }, null, 2), "utf8");

if (!merchantId || !payerId) {
  process.stdout.write(
    [
      "Hedera account ids not on mirror yet. Fund BOTH EVM addresses, wait ~30s, re-run.",
      `Merchant ${merchantEvm} → ${merchantId ?? "not found"}`,
      `Payer    ${payerEvm} → ${payerId ?? "not found"}`,
      "Faucet: https://portal.hedera.com/?network=testnet",
      "",
    ].join("\n"),
  );
  process.exit(2);
}

let raw = raw0;
raw = set(raw, "HEDERA_PAY_TO", merchantId);
raw = set(raw, "HEDERA_OPERATOR_ID", merchantId);
raw = set(raw, "HEDERA_DEMO_ACCOUNT_ID", payerId);
raw = set(raw, "PAYER_ALLOWLIST", payerId);
writeFileSync(envPath, raw, { encoding: "utf8", mode: 0o600 });

process.stdout.write(
  [
    "Patched .env with Hedera account ids.",
    `Payee  HEDERA_PAY_TO=${merchantId}`,
    `Payer  HEDERA_DEMO_ACCOUNT_ID=${payerId}`,
    "PAYER_ALLOWLIST set to the demo payer only.",
    "Next: paste GRAPH_API_KEY into .env if empty, then start servers yourself:",
    "  npm run dev:api",
    "  npm run dev:web",
    "",
  ].join("\n"),
);
