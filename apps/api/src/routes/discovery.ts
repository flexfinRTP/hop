import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { postJson } from "../http.js";

type AgentRegistration = {
  agentId?: string;
  name?: string;
  description?: string;
  mcpEndpoint?: string;
  mcpVersion?: string;
  mcpTools?: string[];
  a2aEndpoint?: string;
  a2aSkills?: string[];
  supportedTrusts?: string[];
  x402Support?: boolean;
  active?: boolean;
};

type Agent0Response = {
  data?: { agentRegistrationFiles?: AgentRegistration[] };
  errors?: { message?: string }[];
};

const AGENT_QUERY = `
  query DiscoverMcpAgents($first: Int!) {
    agentRegistrationFiles(
      where: { mcpEndpoint_not: null, active: true }
      first: $first
      orderBy: agentId
      orderDirection: asc
    ) {
      agentId
      name
      description
      mcpEndpoint
      mcpVersion
      mcpTools
      a2aEndpoint
      a2aSkills
      supportedTrusts
      x402Support
      active
    }
  }
`;

function agent0Url(cfg: ReturnType<typeof loadConfig>): string {
  if (cfg.agent0SubgraphUrl) return cfg.agent0SubgraphUrl;
  if (!cfg.agent0SubgraphId) return "";
  return `https://gateway.thegraph.com/api/subgraphs/id/${cfg.agent0SubgraphId}`;
}

export const discovery = new Hono();

discovery.get("/agents", async (c) => {
  const cfg = loadConfig();
  const url = agent0Url(cfg);
  if (!url || !cfg.graphApiKey) {
    return c.json({ error: "agent0_unconfigured" }, 503);
  }
  const requested = Number(c.req.query("limit") ?? 25);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 25;
  const search = (c.req.query("q") ?? "").trim().toLowerCase();
  const response = await postJson(
    url,
    { query: AGENT_QUERY, variables: { first: limit } },
    { Authorization: `Bearer ${cfg.graphApiKey}` },
  );
  if (response.status < 200 || response.status >= 300) {
    return c.json({ error: "agent0_provider_error", status: response.status }, 502);
  }
  const parsed = JSON.parse(response.text) as Agent0Response;
  if (parsed.errors?.length) {
    return c.json({
      error: "agent0_query_error",
      detail: parsed.errors.map((error) => error.message).filter(Boolean),
    }, 502);
  }
  const agents = (parsed.data?.agentRegistrationFiles ?? []).filter((agent) => {
    if (!search) return true;
    return [
      agent.name,
      agent.description,
      agent.mcpEndpoint,
      ...(agent.mcpTools ?? []),
      ...(agent.a2aSkills ?? []),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
  return c.json({
    source: {
      product: "The Graph Agent0 standardized subgraph",
      subgraph_id: cfg.agent0SubgraphId || null,
      live: true,
    },
    agents,
    count: agents.length,
  });
});

discovery.get("/self", async (c) => {
  const cfg = loadConfig();
  return c.json({
    registered: Boolean(cfg.agent0ChainId && cfg.agent0AgentId),
    chain_id: cfg.agent0ChainId || null,
    agent_id: cfg.agent0AgentId || null,
    registration: "/.well-known/agent-registration.json",
    agent_card: "/.well-known/agent-card.json",
  });
});
