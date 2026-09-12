import {
  LIQUIDATES_QUERY,
  MARKETS_QUERY,
  POSITIONS_QUERY,
  POSITIONS_QUERY_CLOSED_ZERO,
  PROTOCOL_QUERY,
} from "./graphql.js";
import type {
  GraphLiquidate,
  GraphMarket,
  GraphPosition,
  PolicyTable,
  ProtocolSnapshot,
  QueryRequest,
} from "./types.js";

export type GraphHttp = {
  postJson: (
    url: string,
    body: unknown,
    headers?: Record<string, string>,
  ) =>
    | { status: number; text: string }
    | Promise<{ status: number; text: string }>;
};

type GraphEnvelope<T> = {
  data?: T;
  errors?: { message: string }[];
};

type SnapshotData = {
  _meta?: {
    block?: { number?: number; timestamp?: number };
    hasIndexingErrors?: boolean;
  };
  lendingProtocols?: {
    slug?: string;
    schemaVersion?: string;
    subgraphVersion?: string;
    totalValueLockedUSD?: string;
    totalBorrowBalanceUSD?: string;
    totalDepositBalanceUSD?: string;
  }[];
  markets?: GraphMarket[];
};

function parseEnvelope<T>(status: number, raw: string): T {
  if (status < 200 || status >= 300) {
    throw new Error(`graph_http_${status}:${raw.slice(0, 120)}`);
  }
  let parsed: GraphEnvelope<T>;
  try {
    parsed = JSON.parse(raw) as GraphEnvelope<T>;
  } catch {
    throw new Error("graph_json");
  }
  if (!parsed.data) {
    throw new Error(parsed.errors?.[0]?.message ?? "graph_empty");
  }
  return parsed.data;
}

export function snapshotNeeds(
  request: QueryRequest,
  policy?: PolicyTable | null,
): { markets: boolean; positions: boolean; liquidates: boolean } {
  const q = request.query;
  const liqCap = Boolean(
    policy?.caps.some((c) => c.metric === "liquidations_count" || c.metric === "liquidations_usd"),
  );
  return {
    markets: q === "market_params",
    positions: q === "position_counts" || q === "account_ltv",
    liquidates: q === "liquidations" || (q === "policy_check" && liqCap),
  };
}

function syncBody(
  http: GraphHttp,
  url: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>,
): { status: number; text: string } {
  const res = http.postJson(url, { query, variables }, headers);
  if (typeof (res as Promise<unknown>).then === "function") {
    throw new Error("graph_http_async");
  }
  return res as { status: number; text: string };
}

function graphqlSync<T>(
  http: GraphHttp,
  url: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>,
): T {
  const res = syncBody(http, url, query, variables, headers);
  return parseEnvelope<T>(res.status, res.text);
}

async function graphqlAsync<T>(
  http: GraphHttp,
  url: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>,
): Promise<T> {
  const res = await Promise.resolve(http.postJson(url, { query, variables }, headers));
  return parseEnvelope<T>(res.status, res.text);
}

function windowUnix(request: QueryRequest): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  const from = request.window?.from
    ? Math.floor(new Date(request.window.from).getTime() / 1000)
    : now - 86400;
  const to = request.window?.to
    ? Math.floor(new Date(request.window.to).getTime() / 1000)
    : now;
  return { from, to };
}

function toSnapshot(
  args: { slug: string; url: string; deploymentId: string; chainHead?: number },
  data: SnapshotData,
  positions: GraphPosition[],
  liquidates: GraphLiquidate[],
): ProtocolSnapshot {
  const proto = data.lendingProtocols?.[0];
  return {
    slug: proto?.slug ?? args.slug,
    url: args.url,
    deploymentId: args.deploymentId,
    schemaVersion: proto?.schemaVersion ?? "unknown",
    subgraphVersion: proto?.subgraphVersion,
    block: data._meta?.block?.number,
    blockTimestamp: data._meta?.block?.timestamp,
    chainHead: args.chainHead,
    hasIndexingErrors: data._meta?.hasIndexingErrors,
    protocolTvlUsd: Number(proto?.totalValueLockedUSD ?? 0),
    protocolBorrowUsd: Number(proto?.totalBorrowBalanceUSD ?? 0),
    protocolDepositUsd: Number(proto?.totalDepositBalanceUSD ?? 0),
    markets: data.markets ?? [],
    positions,
    liquidates,
  };
}

function positionsSync(http: GraphHttp, url: string, headers: Record<string, string>): GraphPosition[] {
  const out: GraphPosition[] = [];
  let query = POSITIONS_QUERY;
  for (let skip = 0; skip < 10000; skip += 1000) {
    let rows: { positions?: GraphPosition[] };
    try {
      rows = graphqlSync(http, url, query, { skip }, headers);
    } catch (err) {
      if (query === POSITIONS_QUERY) {
        query = POSITIONS_QUERY_CLOSED_ZERO;
        rows = graphqlSync(http, url, query, { skip }, headers);
      } else {
        throw err;
      }
    }
    const batch = rows.positions ?? [];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function positionsAsync(
  http: GraphHttp,
  url: string,
  headers: Record<string, string>,
): Promise<GraphPosition[]> {
  const out: GraphPosition[] = [];
  let query = POSITIONS_QUERY;
  for (let skip = 0; skip < 10000; skip += 1000) {
    let rows: { positions?: GraphPosition[] };
    try {
      rows = await graphqlAsync(http, url, query, { skip }, headers);
    } catch (err) {
      if (query === POSITIONS_QUERY) {
        query = POSITIONS_QUERY_CLOSED_ZERO;
        rows = await graphqlAsync(http, url, query, { skip }, headers);
      } else {
        throw err;
      }
    }
    const batch = rows.positions ?? [];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

function liquidatesSync(
  http: GraphHttp,
  url: string,
  headers: Record<string, string>,
  from: number,
  to: number,
): GraphLiquidate[] {
  const out: GraphLiquidate[] = [];
  for (let skip = 0; skip < 400; skip += 200) {
    const rows = graphqlSync<{ liquidates?: GraphLiquidate[] }>(
      http,
      url,
      LIQUIDATES_QUERY,
      { from: String(from), to: String(to), skip },
      headers,
    );
    const batch = rows.liquidates ?? [];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function liquidatesAsync(
  http: GraphHttp,
  url: string,
  headers: Record<string, string>,
  from: number,
  to: number,
): Promise<GraphLiquidate[]> {
  const out: GraphLiquidate[] = [];
  for (let skip = 0; skip < 400; skip += 200) {
    const rows = await graphqlAsync<{ liquidates?: GraphLiquidate[] }>(
      http,
      url,
      LIQUIDATES_QUERY,
      { from: String(from), to: String(to), skip },
      headers,
    );
    const batch = rows.liquidates ?? [];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

type FetchArgs = {
  slug: string;
  url: string;
  deploymentId: string;
  authHeaders: Record<string, string>;
  request: QueryRequest;
  chainHead?: number;
  policy?: PolicyTable | null;
};

function marketsSync(http: GraphHttp, url: string, headers: Record<string, string>): GraphMarket[] {
  const out: GraphMarket[] = [];
  for (let skip = 0; skip < 1000; skip += 200) {
    const rows = graphqlSync<{ markets?: GraphMarket[] }>(http, url, MARKETS_QUERY, { skip }, headers);
    const batch = rows.markets ?? [];
    out.push(...batch);
    if (batch.length < 200) break;
  }
  return out;
}

async function marketsAsync(
  http: GraphHttp,
  url: string,
  headers: Record<string, string>,
): Promise<GraphMarket[]> {
  const out: GraphMarket[] = [];
  for (let skip = 0; skip < 1000; skip += 200) {
    const rows = await graphqlAsync<{ markets?: GraphMarket[] }>(http, url, MARKETS_QUERY, { skip }, headers);
    const batch = rows.markets ?? [];
    out.push(...batch);
    if (batch.length < 200) break;
  }
  return out;
}

export function fetchProtocolSnapshotSync(http: GraphHttp, args: FetchArgs): ProtocolSnapshot {
  const needs = snapshotNeeds(args.request, args.policy);
  const data = graphqlSync<SnapshotData>(http, args.url, PROTOCOL_QUERY, {}, args.authHeaders);
  const { from, to } = windowUnix(args.request);
  const snap = toSnapshot(
    args,
    data,
    needs.positions ? positionsSync(http, args.url, args.authHeaders) : [],
    needs.liquidates ? liquidatesSync(http, args.url, args.authHeaders, from, to) : [],
  );
  if (needs.markets) snap.markets = marketsSync(http, args.url, args.authHeaders);
  return snap;
}

export async function fetchProtocolSnapshot(http: GraphHttp, args: FetchArgs): Promise<ProtocolSnapshot> {
  const needs = snapshotNeeds(args.request, args.policy);
  const data = await graphqlAsync<SnapshotData>(http, args.url, PROTOCOL_QUERY, {}, args.authHeaders);
  const { from, to } = windowUnix(args.request);
  const snap = toSnapshot(
    args,
    data,
    needs.positions ? await positionsAsync(http, args.url, args.authHeaders) : [],
    needs.liquidates ? await liquidatesAsync(http, args.url, args.authHeaders, from, to) : [],
  );
  if (needs.markets) snap.markets = await marketsAsync(http, args.url, args.authHeaders);
  return snap;
}
