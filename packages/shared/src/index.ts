export const QUERY_TYPES = [
  "market_params",
  "position_counts",
  "liquidations",
  "policy_check",
  "account_ltv",
] as const;

export type QueryType = (typeof QUERY_TYPES)[number];

export type QueryStatus = "accept" | "reject" | "k_anon_denied" | "stale";

export type QueryRequest = {
  query: QueryType;
  protocols: string[];
  max_block_lag: number;
  window?: { from: string; to: string };
};

export type GraphDeployment = {
  id: string;
  schemaVersion: string;
  block?: number;
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

/** Charge table from docs/07. Stale and k-anon are paid. */
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
} as const;

export const K_ANON = 5;
export const MESSARI_SCHEMA = "3.1.0";
export const BLOCKY402_TESTNET = "https://api.testnet.blocky402.com";
export const HBAR_ASSET = "0.0.0";
