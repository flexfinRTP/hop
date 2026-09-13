/** Final archive tag. Hop is sunset. */
export const HOP_VERSION = "0.1.0";
export const HOP_STATUS = "sunset";

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
  subgraphId: string;
  deploymentId?: string;
  slug: string;
  schemaVersion: string;
  subgraphVersion?: string;
  methodologyVersion?: string;
  block?: number;
  blockTimestamp?: number;
};

export const VERIFICATION_TIERS = [
  "recomputed",
  "settlement_confirmed",
  "hcs_confirmed",
  "cre_simulation",
  "cre_don_verified",
] as const;

export type VerificationTier = (typeof VERIFICATION_TIERS)[number];

export type VerificationTiers = Record<VerificationTier, boolean>;

export type VerifyMeans = {
  ok_means: "local_hashes_and_public_settlement";
  cre_ok_means: "structural_simulation_fields";
};

export type ExternalVerification = {
  checked_at: string;
  mirror_node: string;
  settlement: {
    verified: boolean;
    transaction_id: string;
    consensus_timestamp?: string;
    result?: string;
    payer_match: boolean;
    payee_match: boolean;
    amount_match: boolean;
  };
  hcs?: {
    verified: boolean;
    topic: string;
    sequence: number;
    consensus_timestamp?: string;
    payload_match: boolean;
  };
  error?: string;
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
  cre: {
    mode: "simulation" | "don";
    artifact?: string;
    tee?: string;
    trigger?: "http";
    cre_commitment_hash?: string;
    /** @deprecated historical evidence only */
    report_hash?: string;
    execution_id?: string;
    don_status?: string;
    don_executed_in_tee?: boolean;
  };
  world?: { nullifier_hash: string };
  status: QueryStatus;
  verdict?: import("./decision.js").Verdict;
  reason_code?: import("./decision.js").ReasonCode;
  screening?: import("./decision.js").Screening;
  identity?: import("./decision.js").IdentityReceipt;
  hcs_seq?: number;
  hcs_topic?: string;
  verification?: ExternalVerification;
  mandate?: {
    id: string;
    hash: string;
    remaining_tinybars: number;
    remaining_hops: number;
    decision: "ALLOW" | "DENY" | "REVIEW";
  };
  chain?: { prev: string; hash: string };
  meter?: { amount: string; protocols: number; util?: number };
  asset?: {
    intent_id: string;
    contract_id: string;
    lifecycle_verified: boolean;
  };
  peac_hash?: string;
  reason?: HopReason;
  posture?: HopPosture;
};

export type HopReason = {
  stamp: string;
  metric_hash?: string;
  observed?: number;
  freshness: "live" | "stale";
};

export type HopPosture = {
  custody: "non_custodial";
  ofac: "not_screened";
  mor: "testnet_payee";
  cre: "simulation" | "don";
  ats: "unconfigured" | "intent" | "verified" | "simulated";
  world?: "off" | "unique_human";
};

export const DEMO_VERTICAL = "finance.lending_policy_gate" as const;
export type DemoVertical = typeof DEMO_VERTICAL;
export const DECISION_RECEIPT_SCHEMA = "hop.decision.v1" as const;

export type ChargeSemantics = "attempt" | "idempotent_replay";

export type VerifiableDecisionReceipt = {
  schema: typeof DECISION_RECEIPT_SCHEMA;
  decision: {
    status: QueryStatus;
    verdict: import("./decision.js").Verdict;
    reason_code: import("./decision.js").ReasonCode;
    query: QueryType;
    demo_vertical: DemoVertical;
  };
  privacy: {
    policy_values: "omitted";
    graph_source: "public";
    settlement: "public";
  };
  payment: {
    network: "hedera:testnet";
    scheme: "exact";
    rail: "hedera_x402_exact";
    ref: string;
    payer_account?: string;
    amount: string;
  };
  charge: {
    semantics: ChargeSemantics;
    settled: boolean;
  };
  screening: import("./decision.js").Screening;
  identity?: import("./decision.js").IdentityReceipt;
  hcs?: { topic?: string; sequence?: number };
  graph: Evidence["graph"];
  cre: Evidence["cre"];
  hashes: {
    aggregate: string;
    policy: string;
    peac?: string;
    chain?: string;
    cre_commitment?: string;
  };
  verification?: {
    tiers: VerificationTiers;
  };
  evidence_id: string;
  verify_path: string;
};

export type QueryResponse = {
  status: QueryStatus;
  aggregate?: Record<string, unknown>;
  evidence: Evidence;
  receipt: VerifiableDecisionReceipt;
  reason?: HopReason;
  mandate?: Evidence["mandate"];
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

export type TraceRail = "graph" | "hedera" | "cre" | "hop" | "world";

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

export type GraphInterestRate = {
  side?: string | null;
  type?: string | null;
  rate?: string | null;
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
  rates?: GraphInterestRate[] | null;
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
  subgraphId: string;
  deploymentId?: string;
  schemaVersion: string;
  subgraphVersion?: string;
  methodologyVersion?: string;
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
  cre: "CRE: handlerInTee",
  rails: "pay: Hedera x402 exact · decide: CRE join · verify: evidence",
  world: "World ID unique human",
  ats: "Hedera ATS testnet lifecycle",
  demoGraph: "demo: Graph lending",
  mandate: "mandate · LLM never pays",
  peac: "PEAC-shaped receipt",
  hcs: "HCS hash anchor",
  custody: "non-custodial",
  ofac: "OFAC: not screened",
  mor: "testnet payee",
} as const;

export const POSTURE: HopPosture = {
  custody: "non_custodial",
  ofac: "not_screened",
  mor: "testnet_payee",
  cre: "simulation",
  ats: "unconfigured",
  world: "off",
};

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
  {
    id: "risk",
    label: "Risk desk",
    ask: "Are both books over our limit?",
    over: "over",
    clear: "not over",
  },
  {
    id: "insurance",
    label: "Insurance",
    ask: "Did incidents this window go over our limit?",
    over: "over",
    clear: "not over",
  },
  {
    id: "trade",
    label: "Trade",
    ask: "Does this reading clear our cutoff?",
    over: "hold",
    clear: "release",
  },
  {
    id: "tvl",
    label: "TVL",
    ask: "Is combined TVL under our floor?",
    over: "over",
    clear: "not over",
  },
] as const;
