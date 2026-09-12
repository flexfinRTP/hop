import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
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
import { initStore } from "./store.js";

dns.setDefaultResultOrder("ipv4first");

loadEnv({ path: path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });
loadEnv({ path: path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../cre/.env") });

const cfg = loadConfig();
await initStore(cfg.evidenceDir, cfg.evidenceTtlMs);

const app = new Hono();
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

app.route("/v1/query", query);
app.route("/v1/evidence", evidence);
app.route("/v1/events", events);
app.route("/v1/demo", demo);
app.route("/v1/meta", meta);
app.route("/v1/mandate", mandate);
app.route("/v1/world", world);

app.get("/health", (c) => {
  const live = loadConfig();
  return c.json({
    ok: true,
    product: "HOP",
    cre: live.creWorkflowId ? "CRE: don" : LABELS.cre,
    hop_join: live.hopJoin,
    rails: LABELS.rails,
    posture: {
      custody: "non_custodial",
      ofac: "not_screened",
      mor: "testnet_payee",
      cre: live.creWorkflowId ? "don" : "simulation",
    },
  });
});

serve({ fetch: app.fetch, port: cfg.port }, () => {
  console.log(`HOP api :${cfg.port}`);
});
