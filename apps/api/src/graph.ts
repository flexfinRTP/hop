import {
  fetchProtocolSnapshot,
  type GraphHttp,
  type HopSnapshot,
  type QueryRequest,
} from "@hop/shared";
import type { AppConfig } from "./config.js";

function authHeaders(cfg: AppConfig): Record<string, string> {
  if (!cfg.graphApiKey) return {};
  const token = cfg.graphApiKey.startsWith("Bearer ")
    ? cfg.graphApiKey
    : `Bearer ${cfg.graphApiKey}`;
  return { Authorization: token };
}

async function postJson(
  url: string,
  body: unknown,
  hdrs: Record<string, string>,
): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...hdrs },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

export async function chainHead(rpc: string): Promise<number | undefined> {
  if (!rpc) return undefined;
  const res = await postJson(
    rpc,
    { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
    {},
  );
  if (res.status !== 200) return undefined;
  const parsed = JSON.parse(res.text) as { result?: string };
  if (!parsed.result) return undefined;
  return Number.parseInt(parsed.result, 16);
}

export async function liveSnapshot(cfg: AppConfig, request: QueryRequest): Promise<HopSnapshot> {
  const head = await chainHead(cfg.chainRpcUrl);
  const auth = authHeaders(cfg);
  const http: GraphHttp = {
    postJson: (url, body, extra = {}) => postJson(url, body, { ...auth, ...extra }),
  };

  const selected = cfg.protocols.filter((p) => {
    if (request.protocols.length === 0) return true;
    return request.protocols.includes(p.key) || request.protocols.includes(p.slug);
  });
  if (selected.length < 1) throw new Error("graph_unconfigured");

  const protocols = [];
  for (const p of selected) {
    if (!p.url) throw new Error("graph_unconfigured");
    protocols.push(
      await fetchProtocolSnapshot(http, {
        slug: p.slug,
        url: p.url,
        deploymentId: p.id,
        authHeaders: auth,
        request,
        chainHead: head,
      }),
    );
  }
  return { chainHead: head, protocols };
}
