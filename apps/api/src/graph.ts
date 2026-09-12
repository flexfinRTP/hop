import {
  fetchProtocolSnapshot,
  type GraphHttp,
  type HopSnapshot,
  type PolicyTable,
  type ProtocolSnapshot,
  type QueryRequest,
} from "@hop/shared";
import type { AppConfig } from "./config.js";
import { postJson } from "./http.js";

const SNAP_TTL_MS = 12_000;
const snapCache = new Map<string, { at: number; snap: HopSnapshot }>();

const RPC_FALLBACKS = [
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com",
  "https://rpc.ankr.com/eth",
];

function authHeaders(cfg: AppConfig): Record<string, string> {
  if (!cfg.graphApiKey) return {};
  const token = cfg.graphApiKey.startsWith("Bearer ")
    ? cfg.graphApiKey
    : `Bearer ${cfg.graphApiKey}`;
  return { Authorization: token };
}

function cacheKey(request: QueryRequest): string {
  return JSON.stringify({
    q: request.query,
    p: [...request.protocols].sort(),
    lag: request.max_block_lag,
    w: request.window ?? null,
  });
}

async function headFromRpc(rpc: string): Promise<number | undefined> {
  try {
    const res = await postJson(
      rpc,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      },
      {},
      8_000,
    );
    if (res.status !== 200) return undefined;
    const parsed = JSON.parse(res.text) as { result?: string };
    if (!parsed.result) return undefined;
    return Number.parseInt(parsed.result, 16);
  } catch {
    return undefined;
  }
}

export async function chainHead(rpc: string): Promise<number | undefined> {
  const urls = [rpc, ...RPC_FALLBACKS].filter((u, i, all) => u && all.indexOf(u) === i);
  for (const url of urls) {
    const head = await headFromRpc(url);
    if (head) return head;
  }
  return undefined;
}

export async function liveSnapshot(
  cfg: AppConfig,
  request: QueryRequest,
  policy?: PolicyTable | null,
  onTrace?: (rail: "graph" | "cre", msg: string) => void,
): Promise<HopSnapshot> {
  const key = cacheKey(request);
  const hit = snapCache.get(key);
  if (hit && Date.now() - hit.at < SNAP_TTL_MS) return hit.snap;

  const head = await chainHead(cfg.chainRpcUrl);
  onTrace?.("graph", head ? `chain head ${head}` : "chain head skipped");
  const auth = authHeaders(cfg);
  const http: GraphHttp = {
    postJson: (url, body, extra = {}) => postJson(url, body, { ...auth, ...extra }, 45_000),
  };

  const selected = cfg.protocols.filter((p) => {
    if (request.protocols.length === 0) return true;
    return request.protocols.includes(p.key) || request.protocols.includes(p.slug);
  });
  if (selected.length < 1 || selected.some((p) => !p.url)) {
    throw new Error("graph_unconfigured");
  }

  const settled = await Promise.allSettled(
    selected.map((p) =>
      fetchProtocolSnapshot(http, {
        slug: p.slug,
        url: p.url,
        deploymentId: p.id,
        authHeaders: auth,
        request,
        policy,
        chainHead: head,
      }),
    ),
  );

  const protocols: ProtocolSnapshot[] = [];
  const failures: string[] = [];
  settled.forEach((row, i) => {
    const slug = selected[i]?.slug ?? "graph";
    if (row.status === "fulfilled") {
      protocols.push(row.value);
      return;
    }
    const msg = row.reason instanceof Error ? row.reason.message : String(row.reason);
    failures.push(`${slug}: ${msg}`);
    onTrace?.("graph", `${slug} ${msg}`);
  });

  if (protocols.length < 1) {
    throw new Error(failures.join(" | ") || "graph_empty");
  }

  const snap = { chainHead: head, protocols };
  snapCache.set(key, { at: Date.now(), snap });
  return snap;
}

export function cachedPublicUtil(request: QueryRequest): number | undefined {
  const hit = snapCache.get(cacheKey(request));
  if (!hit) return undefined;
  const utils = hit.snap.protocols
    .map((p) => (p.protocolDepositUsd > 0 ? p.protocolBorrowUsd / p.protocolDepositUsd : null))
    .filter((u): u is number => u !== null && Number.isFinite(u));
  if (utils.length < 1) return undefined;
  return Math.min(...utils);
}
