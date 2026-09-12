import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "./config.js";
import { demo } from "./routes/demo.js";
import { events } from "./routes/events.js";
import { evidence } from "./routes/evidence.js";
import { query } from "./routes/query.js";

loadEnv({ path: path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });

const cfg = loadConfig();
const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE"],
    allowHeaders: [
      "Content-Type",
      "X-PAYMENT",
      "PAYMENT-SIGNATURE",
      "Idempotency-Key",
      "X-Hop-Trace",
    ],
  }),
);

app.route("/v1/query", query);
app.route("/v1/evidence", evidence);
app.route("/v1/events", events);
app.route("/v1/demo", demo);

app.get("/health", (c) =>
  c.json({
    ok: true,
    product: "HOP",
    cre: "CRE: simulation",
    rails: "data: Graph (EVM) · pay: Hedera",
  }),
);

serve({ fetch: app.fetch, port: cfg.port }, () => {
  console.log(`HOP api :${cfg.port}`);
});
