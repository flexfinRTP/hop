/**
 * Readiness check. Does not start servers. Does not print secrets.
 * Checks: .env presence, Graph key shape, subgraph query (if key), Blocky402 /supported, Hedera ids.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

function get(raw, key) {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

const lines = [];
function ok(name, pass, detail) {
  lines.push(`${pass ? "OK  " : "NEED"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!existsSync(envPath)) {
  process.stdout.write("NEED  .env — run node scripts/bootstrap-local.mjs\n");
  process.exit(2);
}

const raw = readFileSync(envPath, "utf8");
const graphKey = get(raw, "GRAPH_API_KEY");
const payTo = get(raw, "HEDERA_PAY_TO");
const demoId = get(raw, "HEDERA_DEMO_ACCOUNT_ID");
const demoKey = get(raw, "HEDERA_DEMO_PRIVATE_KEY");
const opKey = get(raw, "HEDERA_OPERATOR_KEY");
const demoSign = get(raw, "HOP_DEMO_SIGN");
const policy = get(raw, "HOP_POLICY_TABLE_JSON");
const hopJoin = get(raw, "HOP_JOIN");

ok(".env file", true, envPath);
ok("policy table", policy.includes("utilization") && policy.includes("0.78"), "both-books 78%");
ok("demo signer on", demoSign === "1", `HOP_DEMO_SIGN=${demoSign || "(empty)"}`);
ok("payer private key present", Boolean(demoKey), "value not shown");
ok("merchant private key present", Boolean(opKey), "value not shown");
ok("HEDERA_PAY_TO", /^0\.0\.\d+$/.test(payTo), payTo || "fund merchant EVM then resolve");
ok("HEDERA_DEMO_ACCOUNT_ID", /^0\.0\.\d+$/.test(demoId), demoId || "fund payer EVM then resolve");
ok("GRAPH_API_KEY", graphKey.length >= 16, graphKey ? "present" : "create at https://thegraph.com/studio/apikeys/");
ok("HOP_JOIN", hopJoin === "cre" || hopJoin === "inline", hopJoin || "(empty, API defaults to cre)");

try {
  const res = await fetch("https://api.testnet.blocky402.com/supported", {
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json());
  const kind = (json.kinds || []).find((k) => k.network === "hedera:testnet");
  const feePayer = kind?.extra?.feePayer || json.signers?.["hedera:*"]?.[0];
  ok("Blocky402 /supported", Boolean(feePayer), feePayer ? `feePayer ${feePayer}` : `http ${res.status}`);
} catch (err) {
  ok("Blocky402 /supported", false, String(err));
}

if (graphKey) {
  const id = get(raw, "GRAPH_PROTOCOL_A_ID");
  const url = `${get(raw, "GRAPH_GATEWAY").replace(/\/$/, "")}/${id}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: graphKey.startsWith("Bearer ") ? graphKey : `Bearer ${graphKey}`,
      },
      body: JSON.stringify({
        query: "{ lendingProtocols { slug schemaVersion } }",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let slug = "";
    try {
      const json = JSON.parse(text);
      slug = json.data?.lendingProtocols?.[0]?.slug ?? json.errors?.[0]?.message ?? text.slice(0, 80);
    } catch {
      slug = text.slice(0, 80);
    }
    ok(
      "Graph Aave query",
      res.ok && (text.includes("schemaVersion") || text.includes("aave")),
      `http ${res.status} ${slug}`,
    );
  } catch (err) {
    ok("Graph Aave query", false, String(err));
  }
}

process.stdout.write(lines.join("\n") + "\n");
