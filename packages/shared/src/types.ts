export const QUERY_TYPES = [
  "market_params",
  "position_counts",
  "liquidations",
  "policy_check",
  "account_ltv",
] as const;

export type QueryType = (typeof QUERY_TYPES)[number];

export type QueryStatus = "accept" | "reject" | "k_anon_denied" | "stale";

export type QueryWindow = { from: string; to: string };

export type QueryRequest = {
  query: QueryType;
  protocols: string[];
  max_block_lag: number;
  window?: QueryWindow;
};

export type GraphDeployment = {
  id: string;
  slug: string;
  schemaVersion: string;
  subgraphVersion?: string;
  block?: number;
  blockTimestamp?: number;
};

export type Evidence = {
  id: string;
  timestamp: string;
  payer_account?: string;
  query: { type: QueryType; params: Record<string, unknown> };
  graph: { deployments: GraphDeployment[] };
  policy: { version: string; threshold_hash: string };
  k_anon: { result: "pass" | "fail" | "not_applicable" };
  aggregate_hash: string;
  settlement: { ref: string };
  cre: { mode: "simulation" | "don"; artifact?: string };
  status: QueryStatus;
  hcs_seq?: number;
};

export type QueryResponse = {
  status: QueryStatus;
  aggregate?: Record<string, unknown>;
  evidence: Evidence;
  trace?: TraceEvent[];
};

export type PaymentRequirements = {
  scheme: "exact";
  network: "hedera:testnet";
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { feePayer: string };
};

export type PaymentRequiredBody = {
  x402Version: 2;
  accepts: PaymentRequirements[];
};

export type TraceRail = "graph" | "hedera" | "cre" | "hop";

export type TraceEvent = {
  t: string;
  rail: TraceRail;
  msg: string;
};

export type PolicyMetric =
  | "utilization"
  | "tvl_usd"
  | "liquidations_count"
  | "liquidations_usd"
  | "combined_utilization";

export type PolicyCap = {
  metric: PolicyMetric;
  op: "gt" | "gte" | "lt" | "lte";
  value: number;
  protocol?: string;
  scope?: "any" | "all";
};

export type PolicyTable = {
  version: string;
  k?: number;
  caps: PolicyCap[];
};

export type GraphMarket = {
  id: string;
  name?: string | null;
  maximumLTV: string;
  liquidationThreshold: string;
  totalValueLockedUSD: string;
  totalBorrowBalanceUSD: string;
  totalDepositBalanceUSD: string;
  inputToken?: { decimals?: number | string | null } | null;
  inputTokenPriceUSD?: string | null;
};

export type GraphPosition = {
  id: string;
  side: string;
  isCollateral?: boolean | null;
  balance: string;
  account?: { id: string } | null;
  market?: {
    id: string;
    inputToken?: { decimals?: number | string | null } | null;
    inputTokenPriceUSD?: string | null;
  } | null;
};

export type GraphLiquidate = {
  id: string;
  amountUSD?: string | null;
  timestamp: string;
};

export type ProtocolSnapshot = {
  slug: string;
  url: string;
  deploymentId: string;
  schemaVersion: string;
  subgraphVersion?: string;
  block?: number;
  blockTimestamp?: number;
  chainHead?: number;
  hasIndexingErrors?: boolean;
  protocolTvlUsd: number;
  protocolBorrowUsd: number;
  protocolDepositUsd: number;
  markets: GraphMarket[];
  positions: GraphPosition[];
  liquidates: GraphLiquidate[];
};

export type HopSnapshot = {
  protocols: ProtocolSnapshot[];
  chainHead?: number;
};

export type HopJoinResult = {
  status: QueryStatus;
  aggregate?: Record<string, unknown>;
  k_anon: Evidence["k_anon"];
  graph: Evidence["graph"];
  policy: Evidence["policy"];
};

export type WallView = {
  sleeve: "cash" | "surplus";
  buffer: number;
  observed: number;
  ats: string;
  graph_pull: false;
  x402: false;
};

export const CHARGE = {
  unpaid: { http: 402, charge: false },
  bad_payment: { http: 400, charge: false },
  policy_unavailable: { http: 503, charge: false },
  stale: { http: 200, charge: true },
  k_anon_denied: { http: 200, charge: true },
  success: { http: 200, charge: true },
  idempotent_replay: { http: 200, charge: false },
} as const;

export const LABELS = {
  cre: "CRE: simulation",
  rails: "data: Graph (EVM) · pay: Hedera",
  ats: "simulated treasury token on Hedera testnet; no claim on T-bills, no investment rights, no promised yield",
  demoGraph: "demo: Graph lending",
} as const;

export const K_ANON = 5;
export const MESSARI_SCHEMA = "3.1.0";
export const BLOCKY402_TESTNET = "https://api.testnet.blocky402.com";
export const HBAR_ASSET = "0.0.0";
export const USDC_HTS_TESTNET = "0.0.429274";

export const DEFAULT_PROTOCOLS = ["aave-v3", "compound-v3"] as const;

export const PINNED_DEPLOYMENTS = {
  "aave-v3": {
    slug: "aave-v3-ethereum",
    id: "JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
    schemaVersion: "3.1.0",
    network: "ethereum",
  },
  "compound-v3": {
    slug: "compound-v3-ethereum",
    id: "AwoxEZbiWLvv6e3QdvdMZw4WDURdGbvPfHmZRc8Dpfz9",
    schemaVersion: "3.1.0",
    network: "ethereum",
  },
} as const;

export const INDUSTRY_CHIPS = [
  { id: "risk", label: "Risk desk", ask: "Are both books over our limit?" },
  { id: "insurance", label: "Insurance", ask: "Did incidents this window go over our limit?" },
  { id: "trade", label: "Trade", ask: "Does this reading clear our cutoff?" },
] as const;
