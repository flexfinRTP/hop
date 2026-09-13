import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { config as loadEnv } from "dotenv";
import { LABELS } from "@hop/shared";
import { loadConfig } from "./config.js";
import { demo } from "./routes/demo.js";
import { events } from "./routes/events.js";
import { evidence } from "./routes/evidence.js";
import { mandate } from "./routes/mandate.js";
import { meta } from "./routes/meta.js";
import { query } from "./routes/query.js";
import { world } from "./routes/world.js";
import { agentCard } from "./agent-card.js";
import { agentRegistration } from "./agent-registration.js";
import { startHcsOutboxWorker } from "./hcs-outbox.js";
import { initStore, storeHealth } from "./store.js";
import { discovery } from "./routes/discovery.js";
import { initAssetStore } from "./asset-store.js";
import { assets } from "./routes/assets.js";
import { liquidation } from "./routes/liquidation.js";
import { identity } from "./routes/identity.js";
import { initPassportStore } from "./passport-store.js";
import { mountAgentDocs } from "./agent-docs.js";
import { hopDidJson, hopOauthResource } from "./hop-did.js";

dns.setDefaultResultOrder("ipv4first");

loadEnv({ path: path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });
loadEnv({ path: path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../cre/.env") });

export const cfg = loadConfig();
await initStore(cfg.evidenceDir, cfg.evidenceTtlMs, cfg.databaseUrl, cfg.databaseSsl);
await initPassportStore(cfg.evidenceDir);
await initAssetStore(cfg.evidenceDir);
export const stopHcsOutbox = startHcsOutboxWorker(cfg);

export const app = new Hono();
const origins = cfg.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  "*",
  cors({
    origin: origins.includes("*") ? "*" : origins,
    exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
    allowHeaders: [
      "Content-Type",
      "X-PAYMENT",
      "PAYMENT-SIGNATURE",
      "Idempotency-Key",
      "X-Hop-Trace",
      "X-Hop-Mandate",
      "X-Hop-Confirm",
      "X-Hop-World",
      "X-Hop-Passport",
      "X-Hop-Did",
      "X-Hop-Erc8004",
    ],
  }),
);

app.use(
  "*",
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  }),
);

mountAgentDocs(app);

app.get("/.well-known/agent-card.json", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(agentCard(loadConfig(), origin));
});
app.get("/.well-known/agent-registration.json", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(agentRegistration(loadConfig(), origin));
});
app.get("/.well-known/did.json", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(hopDidJson(loadConfig(), origin));
});
app.get("/.well-known/oauth-protected-resource", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(hopOauthResource(origin));
});

app.route("/v1/query", query);
app.route("/v1/evidence", evidence);
app.route("/v1/events", events);
app.route("/v1/demo", demo);
app.route("/v1/meta", meta);
app.route("/v1/mandate", mandate);
app.route("/v1/world", world);
app.route("/v1/discovery", discovery);
app.route("/v1/assets", assets);
app.route("/v1/liquidation", liquidation);
app.route("/v1/identity", identity);

app.get("/health", (c) => {
  const live = loadConfig();
  return c.json({
    ok: true,
    product: "HOP",
    cre: live.hopJoin === "cre" ? LABELS.cre : "CRE: inline local",
    hop_join: live.hopJoin,
    don_trigger_configured: Boolean(live.creWorkflowId && live.creEthPrivateKey),
    rails: LABELS.rails,
    storage: storeHealth(),
    posture: {
      custody: "non_custodial",
      ofac: "not_screened",
      mor: "testnet_payee",
      cre: "simulation",
      identity: live.passportSecret ? (live.passportRequired ? "required" : "optional") : "unconfigured",
    },
  });
});
