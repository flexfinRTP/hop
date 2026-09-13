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
const readinessCache = new Map<string, { at: number; result: GraphReadiness }>();

export type GraphReadiness = {
  ok: boolean;
  chainHead?: number;
  sources: {
    key: string;
    subgraphId: string;
    deploymentId?: string;
    block?: number;
    hasIndexingErrors?: boolean;
  }[];
  error?: string;
};

const READINESS_QUERY = `
  query HopGraphReadiness {
    _meta {
      deployment
      hasIndexingErrors
      block { number timestamp }
    }
  }
`;

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

export async function checkGraphReadiness(
  cfg: AppConfig,
  requested: string[],
  maxBlockLag: number,
): Promise<GraphReadiness> {
  const selected = cfg.protocols.filter(
    (protocol) =>
      requested.includes(protocol.key) || requested.includes(protocol.slug),
  );
  const cacheId = `${selected.map((protocol) => protocol.key).sort().join(",")}:${maxBlockLag}`;
  const cached = readinessCache.get(cacheId);
  if (cached && Date.now() - cached.at < 15_000) return cached.result;
  if (selected.length !== new Set(requested).size || selected.some((protocol) => !protocol.url)) {
    return { ok: false, sources: [], error: "graph_unconfigured" };
  }
  const headers = authHeaders(cfg);
  const [head, rows] = await Promise.all([
    chainHead(cfg.chainRpcUrl),
    Promise.allSettled(
    selected.map(async (protocol) => {
      const response = await postJson(
        protocol.url,
        { query: READINESS_QUERY },
        headers,
        15_000,
      );
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`${protocol.key}:http_${response.status}`);
      }
      const parsed = JSON.parse(response.text) as {
        data?: {
          _meta?: {
            deployment?: string;
            hasIndexingErrors?: boolean;
            block?: { number?: number };
          };
        };
        errors?: { message?: string }[];
      };
      if (parsed.errors?.length || !parsed.data?._meta?.block?.number) {
        throw new Error(`${protocol.key}:invalid_meta`);
      }
      return {
        key: protocol.key,
        subgraphId: protocol.id,
        deploymentId: parsed.data._meta.deployment,
        block: parsed.data._meta.block.number,
        hasIndexingErrors: parsed.data._meta.hasIndexingErrors,
      };
    }),
    ),
  ]);
  const sources: GraphReadiness["sources"] = [];
  const errors: string[] = [];
  for (const row of rows) {
    if (row.status === "fulfilled") sources.push(row.value);
    else errors.push(row.reason instanceof Error ? row.reason.message : String(row.reason));
  }
  const result: GraphReadiness = {
    ok:
      typeof head === "number" &&
      sources.length === selected.length &&
      sources.every(
        (source) =>
          source.hasIndexingErrors !== true &&
          typeof source.block === "number" &&
          Math.abs(head - source.block) <= maxBlockLag,
      ),
    chainHead: head,
    sources,
    error: errors[0] ??
      (!head
        ? "chain_head_unavailable"
        : sources.some((source) => source.hasIndexingErrors)
          ? "graph_indexing_errors"
          : sources.some(
              (source) =>
                typeof source.block !== "number" ||
                Math.abs(head - source.block) > maxBlockLag,
            )
            ? "graph_stale"
            : undefined),
  };
  readinessCache.set(cacheId, { at: Date.now(), result });
  return result;
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
        subgraphId: p.id,
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

  if (protocols.length !== selected.length) {
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
