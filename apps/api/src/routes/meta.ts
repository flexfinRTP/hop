import { Hono } from "hono";
import { LABELS, MESSARI_SCHEMA, POSTURE, QUERY_TYPES, parseMandate } from "@hop/shared";
import { loadConfig } from "../config.js";
import { hcsReady } from "../hcs.js";
import { checkCreCli } from "../join-run.js";
import { getSpend, hopsInWindow, storeHealth } from "../store.js";
import { worldReady } from "../world.js";
import { AGENT_DOC_INDEX } from "../agent-docs.js";

export const meta = new Hono();

meta.get("/", async (c) => {
  const cfg = loadConfig();
  const template = parseMandate(cfg.mandateJson);
  const now = Date.now();
  const spend = template ? getSpend(template.id) : undefined;
  const hcs = await hcsReady(cfg);
  const creCli = await checkCreCli(cfg);
  return c.json({
    product: "HOP",
    labels: {
      ...LABELS,
      cre: cfg.hopJoin === "cre" ? LABELS.cre : "CRE: inline local",
    },
    network: cfg.network,
    asset: cfg.asset,
    amount: cfg.amount,
    meter_per_protocol: cfg.meterPerProtocol,
    payTo: cfg.payTo || null,
    demo_sign: cfg.demoSign,
    wall_buffer: cfg.wallBuffer,
    query_types: QUERY_TYPES,
    schemaVersion: MESSARI_SCHEMA,
    mcp_tools: [
      "hop_meta",
      "hop_mandate",
      "hop_pay",
      "hop_query",
      "hop_evidence",
      "hop_peac",
      "hop_verify",
      "hop_world_rp_context",
      "hop_world_verify",
    ],
    agent_card: "/.well-known/agent-card.json",
    agent_registration: "/.well-known/agent-registration.json",
    documentation: AGENT_DOC_INDEX.documentation,
    agent_docs: AGENT_DOC_INDEX,
    hop_join: cfg.hopJoin,
    graph_ready: cfg.protocols.every((p) => Boolean(p.url)),
    graph_configured: cfg.protocols.every((p) => Boolean(p.url)),
    storage: storeHealth(),
    protocols: cfg.protocols.map((p) => ({
      key: p.key,
      slug: p.slug,
      id: p.id,
      configured: Boolean(p.url),
    })),
    posture: {
      ...POSTURE,
      cre: "simulation",
      ats: cfg.atsFactoryAddress && cfg.atsResolverAddress && cfg.atsBondConfigId
        ? "sdk_8_testnet"
        : "unconfigured",
      world: worldReady(cfg) ? "unique_human" : "off",
    },
    cre: {
      join: cfg.hopJoin,
      tee: "nitro:us-west-2",
      trigger: "http",
      workflow_id: cfg.creWorkflowId || null,
      don_trigger_configured: Boolean(cfg.creWorkflowId && cfg.creEthPrivateKey),
      cli_ready: creCli.ok,
      execution:
        cfg.creWorkflowId && cfg.creEthPrivateKey
          ? "don_trigger_configured"
          : cfg.hopJoin === "cre" && creCli.ok
            ? "simulation_ready"
            : "unavailable",
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
    agent0: {
      configured: Boolean(cfg.agent0SubgraphId || cfg.agent0SubgraphUrl),
      registered: Boolean(cfg.agent0AgentId && cfg.agent0Registry),
      discovery: "/v1/discovery/agents",
    },
    ats: {
      configured: Boolean(
        cfg.atsFactoryAddress &&
          cfg.atsResolverAddress &&
          cfg.atsRpcUrl &&
          cfg.atsSdkVersion &&
          cfg.atsBondConfigId,
      ),
      workspace: "/assets",
      factory_address: cfg.atsFactoryAddress || null,
      resolver_address: cfg.atsResolverAddress || null,
      sdk_version: cfg.atsSdkVersion || null,
    },
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
