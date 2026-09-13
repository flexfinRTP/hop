import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { autonomousHopQuery } from "./payer.js";

const API = (process.env.HOP_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
const MANDATE = (process.env.HOP_MANDATE_JSON ?? "").trim();

const server = new Server({ name: "hop", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "hop_query",
      description:
        "Paid Hop decision query (finance demo: lending policy gate). The calling agent must map natural language to one fixed query type and explicitly choose one or two configured protocol keys from hop_meta; Hop does not parse free text or choose sources. Call without payment_b64 to receive 402 PaymentRequirements. Retry with payment_b64 (Hedera exact / Blocky402) and idempotency_key. Optional mandate_json (deterministic budget; LLM never pays). confirm=true after mandate_review. Optional world_token from POST /v1/world/verify. No wallet lists. Policy values omitted from the result. Settlement is public on Hedera. Paid 200 includes receipt (hop.decision.v1). stale and k_anon_denied are charged attempts; persist receipt.evidence_id and do not reuse the payment payload.",
      inputSchema: {
        type: "object",
        required: ["query", "protocols", "max_block_lag"],
        properties: {
          query: {
            type: "string",
            enum: [
              "market_params",
              "position_counts",
              "liquidations",
              "policy_check",
              "account_ltv",
            ],
          },
          protocols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          max_block_lag: { type: "integer", minimum: 0 },
          payment_b64: { type: "string" },
          idempotency_key: { type: "string" },
          mandate_json: { type: "string" },
          confirm: { type: "boolean" },
          world_token: { type: "string" },
        },
      },
    },
    {
      name: "hop_pay",
      description:
        "Autonomous Hedera x402 buyer. Reads payer credentials only from the local MCP process, validates the live quote against the configured network, asset, recipient, facilitator fee payer, local maximum, and mandate budget, signs one exact payment, retries with an idempotency key, then checks Mirror Node-backed evidence. Never returns the private key.",
      inputSchema: {
        type: "object",
        required: ["query", "protocols", "max_block_lag"],
        properties: {
          query: {
            type: "string",
            enum: [
              "market_params",
              "position_counts",
              "liquidations",
              "policy_check",
              "account_ltv",
            ],
          },
          protocols: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          max_block_lag: { type: "integer", minimum: 0 },
          idempotency_key: { type: "string" },
          mandate_json: { type: "string" },
          confirm: { type: "boolean" },
          world_token: { type: "string" },
        },
      },
    },
    {
      name: "hop_evidence",
      description: "Public evidence pack. Hashes, Graph block, settlement ref. No Account.id. No caps.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    {
      name: "hop_peac",
      description: "PEAC-shaped portable receipt for an evidence id (payment + mandate hash + Graph source + result hashes).",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    {
      name: "hop_verify",
      description: "Recompute hashes and confirm public Hedera settlement for an evidence id. Returns tiers (recomputed, settlement, HCS, CRE sim, CRE DON) plus hop.decision.v1 receipt. cre_don_verified is true only after a matched DON result.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    {
      name: "hop_mandate",
      description: "Inspect remaining mandate budget and velocity. Does not pay. LLM cannot raise the cap.",
      inputSchema: {
        type: "object",
        properties: { mandate_json: { type: "string" } },
      },
    },
    {
      name: "hop_world_rp_context",
      description: "World ID 4.0 RP signature for IDKit. Signing key never leaves the API.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "hop_world_verify",
      description: "Forward an IDKit result to World Cloud verify. Returns hop session token for X-Hop-World.",
      inputSchema: {
        type: "object",
        required: ["idkit_response"],
        properties: { idkit_response: { type: "object" } },
      },
    },
    {
      name: "hop_meta",
      description: "Public rails, price, mandate template, HCS, CRE, World ID, posture, agent_docs URLs (llms.txt, OpenAPI, SKILL). No secrets, no caps.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

function mandateHeader(args: Record<string, unknown>): string | undefined {
  const raw = typeof args.mandate_json === "string" && args.mandate_json ? args.mandate_json : MANDATE;
  return raw || undefined;
}

async function hopFetch(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(60_000) });
  return res.text();
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  if (name === "hop_meta") {
    return { content: [{ type: "text", text: await hopFetch("/v1/meta") }] };
  }
  if (name === "hop_evidence") {
    return { content: [{ type: "text", text: await hopFetch(`/v1/evidence/${args.id}`) }] };
  }
  if (name === "hop_peac") {
    return { content: [{ type: "text", text: await hopFetch(`/v1/evidence/${args.id}/peac`) }] };
  }
  if (name === "hop_verify") {
    return { content: [{ type: "text", text: await hopFetch(`/v1/evidence/${args.id}/verify`) }] };
  }
  if (name === "hop_mandate") {
    const headers: Record<string, string> = {};
    const m = mandateHeader(args);
    if (m) headers["X-Hop-Mandate"] = m;
    const res = await fetch(`${API}/v1/mandate`, { headers, signal: AbortSignal.timeout(15_000) });
    return { content: [{ type: "text", text: await res.text() }] };
  }
  if (name === "hop_world_rp_context") {
    const res = await fetch(`${API}/v1/world/rp-context`, { method: "POST", signal: AbortSignal.timeout(15_000) });
    return { content: [{ type: "text", text: await res.text() }] };
  }
  if (name === "hop_world_verify") {
    const res = await fetch(`${API}/v1/world/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idkitResponse: args.idkit_response }),
      signal: AbortSignal.timeout(20_000),
    });
    return { content: [{ type: "text", text: await res.text() }] };
  }
  if (name === "hop_pay") {
    try {
      const result = await autonomousHopQuery(API, {
        query: String(args.query ?? ""),
        protocols: Array.isArray(args.protocols) ? args.protocols.map(String) : [],
        maxBlockLag: Number(args.max_block_lag),
        mandate: mandateHeader(args),
        confirm: args.confirm === true,
        worldToken: typeof args.world_token === "string" ? args.world_token : undefined,
        idempotencyKey:
          typeof args.idempotency_key === "string" ? args.idempotency_key : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "autonomous_payment_failed",
          }),
        }],
        isError: true,
      };
    }
  }
  if (name !== "hop_query") {
    return { content: [{ type: "text", text: "unknown_tool" }], isError: true };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof args.payment_b64 === "string" && args.payment_b64) {
    headers["X-PAYMENT"] = args.payment_b64;
  }
  if (typeof args.idempotency_key === "string" && args.idempotency_key) {
    headers["Idempotency-Key"] = args.idempotency_key;
  }
  const m = mandateHeader(args);
  if (m) headers["X-Hop-Mandate"] = m;
  if (args.confirm === true) headers["X-Hop-Confirm"] = "1";
  if (typeof args.world_token === "string" && args.world_token) headers["X-Hop-World"] = args.world_token;
  const res = await fetch(`${API}/v1/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: args.query,
      protocols: args.protocols,
      max_block_lag: args.max_block_lag,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  return { content: [{ type: "text", text: await res.text() }] };
});

await server.connect(new StdioServerTransport());
