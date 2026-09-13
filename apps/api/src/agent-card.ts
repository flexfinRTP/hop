import { HOP_VERSION, MESSARI_SCHEMA, PINNED_DEPLOYMENTS } from "@hop/shared";
import type { AppConfig } from "./config.js";
import { hopDidFor } from "./hop-did.js";

export function agentCard(cfg: AppConfig, origin = "http://localhost:8787") {
  const base = origin.replace(/\/$/, "");
  const did = hopDidFor(cfg, base);
  return {
    protocolVersion: "0.2.9",
    name: "Hop",
    description:
      "Paid decision query. The tool call before the tool call that cannot be undone. Point an agent at /llms.txt, /openapi.yaml, or /SKILL.md. Hedera exact x402 in seconds. No login. Public settlement, Messari Lending/CDP 3.1.0, CRE handlerInTee. Finance demo: lending policy gate. Enterprise: uninsured process without a receipt.",
    url: `${base}/v1/query`,
    preferredTransport: "HTTP",
    provider: { organization: "Hop", url: base },
    version: HOP_VERSION,
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    securitySchemes: {
      x402: {
        type: "apiKey",
        in: "header",
        name: "X-PAYMENT",
        description: "x402 exact PaymentPayload. Unpaid calls return HTTP 402. Not OAuth.",
      },
    },
    security: [{ x402: [] }],
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
        security: [{ x402: [] }],
      },
    ],
    additionalInterfaces: [
      { url: `${base}/v1/meta`, transport: "HTTP" },
      { url: `${base}/v1/evidence`, transport: "HTTP" },
      { url: `${base}/.well-known/did.json`, transport: "HTTP" },
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
        "hop_passport_issue",
        "hop_passport_get",
        "hop_passport_bind",
        "hop_passport_revoke",
      ],
      discovery: {
        registration: "/.well-known/agent-registration.json",
        agent0: "/v1/discovery/agents",
        did: "/.well-known/did.json",
        oauth_protected_resource: "/.well-known/oauth-protected-resource",
      },
      did,
      documentation: "/documentation/README.md",
      agent_docs: {
        llms: "/llms.txt",
        openapi: "/openapi.yaml",
        skill: "/SKILL.md",
        swagger: "/swagger.html",
        docs: "/docs",
        judge: "/docs/judge",
      },
    },
  };
}
