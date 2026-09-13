/** W3C DID Core identifier (syntax only). Not a resolver. */
const DID_RE = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;

/** ERC-8004 registration pointer: `{namespace}:{chainId}:{identityRegistry}`. */
const ERC8004_REGISTRY_RE = /^[a-z0-9]+:[a-zA-Z0-9-]+:.+$/;

export type Erc8004Ref = {
  agent_id: number;
  agent_registry: string;
};

export type DidDocumentService = {
  id: string;
  type: string;
  serviceEndpoint: string;
};

export type DidDocument = {
  "@context": string[];
  id: string;
  service: DidDocumentService[];
};

export function isDid(value: string): boolean {
  return DID_RE.test(value);
}

export function parseDid(raw: string | undefined | null): { did: string } | { error: "did_invalid" } | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  if (!isDid(value)) return { error: "did_invalid" };
  return { did: value };
}

export function parseErc8004(raw: unknown): { erc8004: Erc8004Ref } | { error: "erc8004_invalid" } | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      return parseErc8004(JSON.parse(trimmed));
    } catch {
      const semi = trimmed.split(";");
      if (semi.length === 2) {
        return parseErc8004({ agentId: semi[0], agentRegistry: semi[1] });
      }
      const at = trimmed.split("@");
      if (at.length === 2) {
        return parseErc8004({ agentId: at[0], agentRegistry: at[1] });
      }
      return { error: "erc8004_invalid" };
    }
  }
  if (typeof raw !== "object") return { error: "erc8004_invalid" };
  const row = raw as Record<string, unknown>;
  const agentId = Number(row.agent_id ?? row.agentId);
  const registry = String(row.agent_registry ?? row.agentRegistry ?? "").trim();
  if (!Number.isInteger(agentId) || agentId < 0) return { error: "erc8004_invalid" };
  if (!ERC8004_REGISTRY_RE.test(registry)) return { error: "erc8004_invalid" };
  return { erc8004: { agent_id: agentId, agent_registry: registry } };
}

export function didWebFromOrigin(origin: string): string {
  const url = new URL(origin);
  const host = url.hostname.toLowerCase();
  const implicit =
    (url.protocol === "https:" && (url.port === "" || url.port === "443")) ||
    (url.protocol === "http:" && (url.port === "" || url.port === "80"));
  const hostId = implicit || !url.port ? host : `${host}%3A${url.port}`;
  const path = url.pathname.replace(/\/+$/, "");
  const pathId =
    !path || path === "/"
      ? ""
      : `:${path
          .replace(/^\//, "")
          .split("/")
          .map((part) => encodeURIComponent(part))
          .join(":")}`;
  return `did:web:${hostId}${pathId}`;
}

export function hopDidDocument(input: {
  did: string;
  origin: string;
  mcpPublicUrl?: string;
}): DidDocument {
  const base = input.origin.replace(/\/$/, "");
  const did = input.did;
  const service: DidDocumentService[] = [
    { id: `${did}#x402`, type: "x402", serviceEndpoint: `${base}/v1/query` },
    { id: `${did}#a2a`, type: "AgentCard", serviceEndpoint: `${base}/.well-known/agent-card.json` },
    {
      id: `${did}#erc8004`,
      type: "ERC8004Registration",
      serviceEndpoint: `${base}/.well-known/agent-registration.json`,
    },
    { id: `${did}#openapi`, type: "OpenAPI", serviceEndpoint: `${base}/openapi.yaml` },
    { id: `${did}#llms`, type: "llms.txt", serviceEndpoint: `${base}/llms.txt` },
    { id: `${did}#skill`, type: "AgentSkill", serviceEndpoint: `${base}/SKILL.md` },
  ];
  if (input.mcpPublicUrl) {
    service.splice(2, 0, {
      id: `${did}#mcp`,
      type: "MCP",
      serviceEndpoint: input.mcpPublicUrl,
    });
  }
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: did,
    service,
  };
}

export function oauthProtectedResource(origin: string): Record<string, unknown> {
  const base = origin.replace(/\/$/, "");
  return {
    resource: base,
    authorization_servers: [],
    bearer_methods_supported: [],
    resource_documentation: `${base}/docs`,
    resource_policy_uri: `${base}/documentation/identity.md`,
    hop: {
      public_query: "x402_exact",
      oauth_on_query: false,
      query: `${base}/v1/query`,
      mcp_transport: "stdio",
    },
  };
}
