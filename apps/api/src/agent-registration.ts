import type { AppConfig } from "./config.js";

export function agentRegistration(cfg: AppConfig, origin: string) {
  const base = (cfg.publicBaseUrl || origin).replace(/\/$/, "");
  const endpoints: Record<string, unknown>[] = [];
  if (cfg.mcpPublicUrl) {
    endpoints.push({
      name: "MCP",
      endpoint: cfg.mcpPublicUrl,
      version: "2025-06-18",
      mcpTools: [
        "hop_meta",
        "hop_mandate",
        "hop_pay",
        "hop_query",
        "hop_evidence",
        "hop_peac",
        "hop_verify",
      ],
      mcpPrompts: [],
      mcpResources: ["documentation", "openapi", "agent-card"],
    });
  }
  endpoints.push({
    name: "A2A",
    endpoint: `${base}/.well-known/agent-card.json`,
    version: "0.2.9",
    a2aSkills: ["decision-query", "x402-payment", "evidence-verification"],
  });

  const registrations =
    cfg.agent0AgentId && cfg.agent0Registry
      ? [{ agentId: Number(cfg.agent0AgentId), agentRegistry: cfg.agent0Registry }]
      : [];

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Hop",
    description:
      "Hedera x402 decision agent. Public settlement, private policy join over standardized Messari subgraphs and a Chainlink CRE confidential workflow. Demo: lending policy gate.",
    image: cfg.registrationImageUrl || undefined,
    endpoints,
    registrations,
    supportedTrusts: ["tee-attestation"],
    active: true,
    x402Support: true,
  };
}
