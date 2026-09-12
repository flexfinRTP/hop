import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { evidence } from "./routes/evidence.js";
import { query } from "./routes/query.js";

const app = new Hono();

app.use("*", cors());
app.route("/v1/query", query);
app.route("/v1/evidence", evidence);

app.get("/health", (c) => c.json({ ok: true, product: "HOP" }));

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(`HOP api :${port}`);
});
