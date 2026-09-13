import { MESSARI_SCHEMA, PINNED_DEPLOYMENTS } from "@hop/shared";
import type { AppConfig } from "./config.js";

export function agentCard(cfg: AppConfig, origin = "http://localhost:8787") {
  const base = origin.replace(/\/$/, "");
  return {
    protocolVersion: "0.2.9",
    name: "Hop",
    description:
      "Paid decision query. Point an agent at /llms.txt, /openapi.yaml, or /SKILL.md to integrate Hedera exact x402 in seconds. Public settlement, Messari Lending/CDP 3.1.0 sources, CRE handlerInTee policy join. Finance demo: lending policy gate.",
    url: `${base}/v1/query`,
    preferredTransport: "HTTP",
    provider: { organization: "Hop", url: base },
    version: "0.0.70",
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "hop_query",
        name: "hop_query",
        description:
          "Enumerated decision queries over configured Messari 3.1.0 subgraphs. Caller supplies query type and protocol keys. Unpaid calls return HTTP 402. Policy values omitted.",
        tags: ["x402", "hedera", "the-graph", "cre", "decision"],
        examples: [
          'POST /v1/query {"query":"policy_check","protocols":["aave-v3","compound-v3"],"max_block_lag":50}',
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
    additionalInterfaces: [
      { url: `${base}/v1/meta`, transport: "HTTP" },
      { url: `${base}/v1/evidence`, transport: "HTTP" },
    ],
    metadata: {
      x402: {
        scheme: "exact",
        network: cfg.network,
        asset: cfg.asset,
        facilitator: cfg.facilitatorUrl,
        payTo: cfg.payTo || null,
        meter: {
          base_tinybars: cfg.amount,
          extra_per_protocol_tinybars: cfg.meterPerProtocol,
        },
      },
      graph: {
        schema: "Messari Lending/CDP",
        schemaVersion: MESSARI_SCHEMA,
        subgraphs: Object.entries(PINNED_DEPLOYMENTS).map(([key, row]) => ({
          key,
          slug: row.slug,
          subgraphId: row.id,
        })),
      },
      cre: {
        artifact: "handlerInTee",
        tee: "nitro:us-west-2",
        trigger: "http",
      },
      mcp: [
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
      discovery: {
        registration: "/.well-known/agent-registration.json",
        agent0: "/v1/discovery/agents",
      },
      documentation: "/documentation/README.md",
      agent_docs: {
        llms: "/llms.txt",
        openapi: "/openapi.yaml",
        skill: "/SKILL.md",
        swagger: "/swagger.html",
      },
    },
  };
}
