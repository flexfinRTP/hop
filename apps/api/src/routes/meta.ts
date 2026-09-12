import { Hono } from "hono";
import { LABELS, MESSARI_SCHEMA, POSTURE, QUERY_TYPES, parseMandate } from "@hop/shared";
import { loadConfig } from "../config.js";
import { hcsReady } from "../hcs.js";
import { getSpend, hopsInWindow } from "../store.js";
import { worldReady } from "../world.js";

export const meta = new Hono();

meta.get("/", async (c) => {
  const cfg = loadConfig();
  const template = parseMandate(cfg.mandateJson);
  const now = Date.now();
  const spend = template ? getSpend(template.id) : undefined;
  const hcs = await hcsReady(cfg);
  return c.json({
    product: "HOP",
    labels: LABELS,
    network: cfg.network,
    asset: cfg.asset,
    amount: cfg.amount,
    meter_per_protocol: cfg.meterPerProtocol,
    payTo: cfg.payTo || null,
    demo_sign: cfg.demoSign,
    wall_buffer: cfg.wallBuffer,
    query_types: QUERY_TYPES,
    schemaVersion: MESSARI_SCHEMA,
    hop_join: cfg.hopJoin,
    graph_ready: cfg.protocols.every((p) => Boolean(p.url)),
    protocols: cfg.protocols.map((p) => ({
      key: p.key,
      slug: p.slug,
      id: p.id,
      configured: Boolean(p.url),
    })),
    posture: {
      ...POSTURE,
      cre: cfg.creWorkflowId ? "don" : "simulation",
      world: worldReady(cfg) ? "unique_human" : "off",
    },
    cre: {
      join: cfg.hopJoin,
      tee: "nitro:us-west-2",
      trigger: "http",
      workflow_id: cfg.creWorkflowId || null,
    },
    mandate_required: cfg.mandateRequired,
    mandate: template
      ? {
          id: template.id,
          agent_id: template.agent_id,
          max_tinybars: template.max_tinybars,
          max_hops: template.max_hops,
          window_s: template.window_s,
          expires_at: template.expires_at,
          human_threshold_tinybars: template.human_threshold_tinybars,
          remaining_tinybars: Math.max(0, template.max_tinybars - (spend?.spent_tinybars ?? 0)),
          remaining_hops: Math.max(0, template.max_hops - hopsInWindow(template.id, template.window_s, now)),
          template,
        }
      : null,
    hcs: { ready: Boolean(hcs.topic), topic: hcs.topic ?? null, auto: hcs.auto },
    world: {
      ready: worldReady(cfg),
      required: cfg.worldRequired,
      app_id: cfg.worldAppId || null,
      rp_id: cfg.worldRpId || null,
      action: cfg.worldAction,
      environment: cfg.worldEnvironment,
    },
  });
});
