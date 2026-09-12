import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { issueWorldToken, signWorldRequest, verifyWorldProof, worldReady } from "../world.js";

export const world = new Hono();

world.get("/", (c) => {
  const cfg = loadConfig();
  return c.json({
    ready: worldReady(cfg),
    required: cfg.worldRequired,
    app_id: cfg.worldAppId || null,
    rp_id: cfg.worldRpId || null,
    action: cfg.worldAction,
    environment: cfg.worldEnvironment,
  });
});

world.post("/rp-context", (c) => {
  const cfg = loadConfig();
  try {
    return c.json(signWorldRequest(cfg, cfg.worldAction));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "world_unconfigured" }, 503);
  }
});

world.post("/verify", async (c) => {
  const cfg = loadConfig();
  const body = await c.req.json().catch(() => null);
  const idkitResponse =
    body && typeof body === "object" && "idkitResponse" in body
      ? (body as { idkitResponse: unknown }).idkitResponse
      : body;
  try {
    const nullifier = await verifyWorldProof(cfg, idkitResponse);
    const token = issueWorldToken(cfg, nullifier);
    return c.json({ ok: true, token });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "world_verify_failed" }, 400);
  }
});
