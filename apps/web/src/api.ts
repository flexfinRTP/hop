import type { AssetIntent, AssetTerms } from "@hop/shared/ui";

export type QueryType =
  | "market_params"
  | "position_counts"
  | "liquidations"
  | "policy_check"
  | "account_ltv";

export type QueryBody = {
  query: QueryType;
  protocols: string[];
  max_block_lag: number;
  window?: { from: string; to: string };
};

export type MandateView = {
  id: string;
  agent_id: string;
  max_tinybars: number;
  max_hops: number;
  remaining_tinybars: number;
  remaining_hops: number;
  human_threshold_tinybars: number;
  expires_at: string;
  template: Record<string, unknown>;
  assurance?: { level?: string; kind?: string; consumer_prompt?: string };
};

export type Meta = {
  product?: string;
  version?: string;
  status?: string;
  network?: string;
  payTo?: string | null;
  schemaVersion?: string;
  demo_sign: boolean;
  wall_buffer: number;
  graph_ready: boolean;
  graph_configured?: boolean;
  asset: string;
  amount: string;
  meter_per_protocol?: string;
    protocols: { key: string; slug: string; id: string; configured: boolean }[];
  labels: { cre: string; rails: string; demoGraph: string; mandate?: string; peac?: string; hcs?: string; world?: string };
  posture?: { custody: string; ofac: string; mor: string; cre?: string };
  mandate?: MandateView | null;
  mandate_required?: boolean;
  hcs?: { ready: boolean; topic: string | null; auto: boolean };
  hop_join?: string;
  mcp_tools?: string[];
  agent_card?: string;
  documentation?: string;
  storage?: { mode: "postgres" | "file"; durable: boolean };
  agent_registration?: string;
  cre?: {
    join: string;
    tee: string;
    trigger: string;
    workflow_id: string | null;
    don_trigger_configured?: boolean;
    cli_ready?: boolean;
    execution?: string;
  };
  agent0?: { configured: boolean; registered: boolean; discovery: string };
  ats?: {
    configured: boolean;
    workspace: string;
    factory_address: string | null;
    resolver_address: string | null;
    sdk_version: string | null;
  };
  world?: {
    ready: boolean;
    required: boolean;
    app_id: string | null;
    rp_id: string | null;
    action: string;
    environment: "staging" | "production";
  };
  identity?: {
    ready: boolean;
    required: boolean;
    header: string;
    issue: string;
    did_header?: string;
    erc8004_header?: string;
  };
  hitl?: {
    default: string;
    mandate_review: boolean;
    world: boolean;
    confirm_header: string;
    world_header: string;
  };
  standards?: Record<string, unknown>;
  rails?: {
    pay: string;
    decide: string;
    verify: string;
    verify_page?: string;
    identity: string;
    did?: string;
  };
};

export type EvidencePack = {
  id: string;
  timestamp: string;
  payer_account?: string;
  query: { type: QueryType; params: Record<string, unknown> };
  graph: {
    deployments: {
      id: string;
      subgraphId?: string;
      deploymentId?: string;
      slug?: string;
      schemaVersion: string;
      methodologyVersion?: string;
      block?: number;
      blockTimestamp?: number;
    }[];
  };
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
    report_hash?: string;
    execution_id?: string;
    don_status?: string;
    don_executed_in_tee?: boolean;
  };
  world?: { nullifier_hash: string };
  status: "accept" | "reject" | "k_anon_denied" | "stale";
  verdict?: "ALLOW" | "HOLD" | "DENY" | "REVIEW";
  reason_code?: string;
  screening?: { ofac: string; kyc: string; world: string };
  identity?: {
    passport_id?: string;
    agent_id?: string;
    policy_root?: string;
    did?: string;
    erc8004?: { agent_id: number; agent_registry: string };
  };
  hcs_seq?: number;
  hcs_topic?: string;
  mandate?: {
    id: string;
    hash: string;
    remaining_tinybars: number;
    remaining_hops: number;
    decision: "ALLOW" | "DENY" | "REVIEW";
  };
  chain?: { prev: string; hash: string };
  meter?: { amount: string; protocols: number; util?: number };
  peac_hash?: string;
  verification?: {
    checked_at: string;
    settlement: { verified: boolean };
    hcs?: { verified: boolean };
    error?: string;
  };
  asset?: {
    intent_id: string;
    contract_id: string;
    lifecycle_verified: boolean;
  };
  reason?: {
    stamp: string;
    metric_hash?: string;
    observed?: number;
    freshness: "live" | "stale";
  };
};

export type DecisionReceipt = {
  schema: "hop.decision.v1";
  decision: {
    status: EvidencePack["status"];
    verdict: "ALLOW" | "HOLD" | "DENY" | "REVIEW";
    reason_code: string;
    query: QueryType;
    demo_vertical: "finance.lending_policy_gate";
  };
  privacy: {
    policy_values: "omitted";
    graph_source: "public";
    settlement: "public";
  };
  payment: {
    network: "hedera:testnet";
    scheme: "exact";
    rail?: "hedera_x402_exact";
    ref: string;
    payer_account?: string;
    amount: string;
  };
  charge: {
    semantics: "attempt" | "idempotent_replay";
    settled: boolean;
  };
  screening?: { ofac: string; kyc: string; world: string };
  identity?: {
    passport_id?: string;
    agent_id?: string;
    policy_root?: string;
    did?: string;
    erc8004?: { agent_id: number; agent_registry: string };
  };
  hcs?: { topic?: string; sequence?: number };
  graph: EvidencePack["graph"];
  cre: EvidencePack["cre"];
  hashes: {
    aggregate: string;
    policy: string;
    peac?: string;
    chain?: string;
    cre_commitment?: string;
  };
  evidence_id: string;
  verify_path?: string;
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init);
}

export async function getMeta(): Promise<Meta> {
  const res = await api("/v1/meta");
  if (!res.ok) throw new Error(`meta_${res.status}`);
  const json = (await res.json()) as Meta;
  if (!json || typeof json !== "object" || !Array.isArray(json.protocols)) {
    throw new Error("meta_shape");
  }
  return json;
}

export function openTrace(traceId: string, onEvent: (ev: { t: string; rail: string; msg: string }) => void): () => void {
  const es = new EventSource(`/v1/events/${traceId}`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as { t: string; rail: string; msg: string });
    } catch {
      return;
    }
  };
  return () => es.close();
}

export async function postQuery(
  body: QueryBody,
  opts: {
    payment?: string;
    idem?: string;
    traceId: string;
    mandate?: string;
    confirm?: boolean;
    world?: string;
    passport?: string;
    did?: string;
    erc8004?: string;
  },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hop-Trace": opts.traceId,
  };
  if (opts.payment) headers["X-PAYMENT"] = opts.payment;
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  if (opts.mandate) headers["X-Hop-Mandate"] = opts.mandate;
  if (opts.confirm) headers["X-Hop-Confirm"] = "1";
  if (opts.world) headers["X-Hop-World"] = opts.world;
  if (opts.passport) headers["X-Hop-Passport"] = opts.passport;
  if (opts.did) headers["X-Hop-Did"] = opts.did;
  if (opts.erc8004) headers["X-Hop-Erc8004"] = opts.erc8004;
  const res = await api("/v1/query", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function signDemo(requirements: unknown): Promise<string> {
  const res = await api("/v1/demo/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirements }),
  });
  const json = (await res.json()) as { payment?: string; error?: string };
  if (!res.ok || !json.payment) throw new Error(json.error ?? "demo_sign_failed");
  return json.payment;
}

export async function getEvidence(id: string): Promise<EvidencePack> {
  const res = await api(`/v1/evidence/${id}`);
  if (!res.ok) throw new Error(`evidence_${res.status}`);
  return res.json() as Promise<EvidencePack>;
}

export async function getEvidenceList(limit = 50): Promise<EvidencePack[]> {
  const res = await api(`/v1/evidence?limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`);
  if (!res.ok) throw new Error(`evidence_list_${res.status}`);
  const json = (await res.json()) as { items?: EvidencePack[] };
  return Array.isArray(json.items) ? json.items : [];
}

export async function getPeac(id: string): Promise<unknown> {
  const res = await api(`/v1/evidence/${id}/peac`);
  return res.json();
}

export type VerifyPack = {
  ok: boolean;
  tiers?: {
    recomputed: boolean;
    settlement_confirmed: boolean;
    hcs_confirmed: boolean;
    cre_simulation: boolean;
    cre_don_verified: boolean;
  };
  ok_means?: "local_hashes_and_public_settlement";
  cre_ok_means?: "structural_simulation_fields";
  hcs_present?: boolean;
  receipt?: DecisionReceipt;
  aggregate_ok?: boolean;
  chain_ok?: boolean;
  predecessor_ok?: boolean;
  peac_ok?: boolean;
  cre_ok?: boolean;
  settlement_ref_present?: boolean;
  external_settlement_verified?: boolean;
  external_hcs_verified?: boolean;
  verification?: EvidencePack["verification"];
  id?: string;
  error?: string;
};

export async function getVerify(id: string): Promise<VerifyPack> {
  const res = await api(`/v1/evidence/${id}/verify`);
  const json = (await res.json().catch(() => ({}))) as Partial<VerifyPack> & { error?: string };
  if (!res.ok || typeof json.ok !== "boolean") {
    throw new Error(json.error ?? `verify_${res.status}`);
  }
  return json as VerifyPack;
}

export type AtsConfig = {
  configured: boolean;
  network: "hedera:testnet";
  chain_id: 296;
  factory_address: string | null;
  resolver_address: string | null;
  rpc_url: string;
  mirror_node_url: string;
  explorer_url: string;
  sdk_version: string | null;
  bond_config_id: string | null;
  bond_config_version: number;
  wallet_required: boolean;
  custody: "browser_wallet";
  stages: string[];
  optional_stages?: string[];
};

export async function getAtsConfig(): Promise<AtsConfig> {
  const res = await api("/v1/assets/config");
  if (!res.ok) throw new Error(`ats_config_${res.status}`);
  return res.json() as Promise<AtsConfig>;
}

export async function getAssetIntents(limit = 50): Promise<AssetIntent[]> {
  const res = await api(`/v1/assets?limit=${Math.max(1, Math.min(100, Math.trunc(limit)))}`);
  if (!res.ok) throw new Error(`asset_intents_${res.status}`);
  const json = (await res.json()) as { items?: AssetIntent[] };
  return Array.isArray(json.items) ? json.items : [];
}

export async function createAssetIntent(input: {
  evidence_id: string;
  action: AssetIntent["action"];
  terms: AssetTerms;
  controllist: "allowlist" | "blocklist";
  clearing: boolean;
  kyc?: boolean;
  parent_intent_id?: string;
}): Promise<AssetIntent> {
  const res = await api("/v1/assets/intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    intent?: AssetIntent;
    error?: string;
  };
  if (!res.ok || !json.intent) throw new Error(json.error ?? `asset_intent_${res.status}`);
  return json.intent;
}

export async function submitAssetTransactions(
  intentId: string,
  input: {
    wallet_account: string;
    asset_contract: string;
    transactions: { stage: string; transaction_id: string }[];
  },
): Promise<AssetIntent> {
  const res = await api(`/v1/assets/intents/${encodeURIComponent(intentId)}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    intent?: AssetIntent;
    error?: string;
  };
  if (!res.ok || !json.intent) throw new Error(json.error ?? `asset_verify_${res.status}`);
  return json.intent;
}

export type LiquidationState = {
  configured: boolean;
  chain_id: 11155111;
  participant: string | null;
  workflow_id: string | null;
  contracts: {
    challenge: string;
    veth: string;
    vusd: string;
    explorer: string;
  };
  challenge_open?: boolean;
  joined?: boolean;
  scenario?: {
    state: "waiting" | "active" | "stopped";
    started_at: string;
    ended_at: string;
  };
  position?: {
    collateral_veth_units: string;
    debt_vusd_units: string;
    stored_health_factor_x100: string;
    live_health_factor_x100: string | null;
    operations: string;
    last_update_time: string;
    cumulative_debt_time: string;
  };
  reserves?: { veth_units: string; vusd_units: string };
  veth_price_vusd_units?: string;
  loan_continuity_score_bps?: string;
  error?: string;
};

export async function getLiquidationState(): Promise<LiquidationState> {
  const res = await api("/v1/liquidation");
  const json = (await res.json().catch(() => ({}))) as LiquidationState;
  if (!res.ok) throw new Error(json.error ?? `liquidation_${res.status}`);
  return json;
}

export async function worldRpContext(): Promise<{
  rp_id: string;
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}> {
  const res = await api("/v1/world/rp-context", { method: "POST" });
  const json = (await res.json()) as {
    rp_id?: string;
    sig?: string;
    nonce?: string;
    created_at?: number;
    expires_at?: number;
    error?: string;
  };
  if (!res.ok || !json.rp_id || !json.sig) throw new Error(json.error ?? "world_rp");
  return {
    rp_id: json.rp_id,
    sig: json.sig,
    nonce: json.nonce ?? "",
    created_at: json.created_at ?? 0,
    expires_at: json.expires_at ?? 0,
  };
}

export async function worldVerify(idkitResponse: unknown): Promise<{ token: string }> {
  const res = await api("/v1/world/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idkitResponse }),
  });
  const json = (await res.json()) as { token?: string; error?: string };
  if (!res.ok || !json.token) throw new Error(json.error ?? "world_verify");
  return { token: json.token };
}

export type PassportRecord = {
  id: string;
  agent_id: string;
  capabilities: string[];
  issued_at: string;
  expires_at: string;
  policy_root: string;
  status: "active" | "revoked";
  revoked_at?: string;
  did?: string;
  erc8004?: { agent_id: number; agent_registry: string };
};

export async function listPassports(): Promise<{
  items: PassportRecord[];
  required: boolean;
}> {
  const res = await api("/v1/identity/passports");
  const json = (await res.json().catch(() => ({}))) as {
    items?: PassportRecord[];
    required?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `passports_${res.status}`);
  return { items: Array.isArray(json.items) ? json.items : [], required: Boolean(json.required) };
}

export async function issuePassport(input: {
  agent_id: string;
  capabilities?: string[];
  mandate?: unknown;
  did?: string;
  erc8004?: unknown;
}): Promise<{ passport: PassportRecord; token: string }> {
  const res = await api("/v1/identity/passports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    passport?: PassportRecord;
    token?: string;
    error?: string;
  };
  if (!res.ok || !json.passport || !json.token) {
    throw new Error(json.error ?? `passport_issue_${res.status}`);
  }
  return { passport: json.passport, token: json.token };
}

export async function bindPassport(
  id: string,
  mandate?: unknown,
): Promise<{ passport: PassportRecord; token: string }> {
  const res = await api(`/v1/identity/passports/${encodeURIComponent(id)}/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mandate }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    passport?: PassportRecord;
    token?: string;
    error?: string;
  };
  if (!res.ok || !json.passport || !json.token) {
    throw new Error(json.error ?? `passport_bind_${res.status}`);
  }
  return { passport: json.passport, token: json.token };
}

export async function revokePassport(id: string): Promise<PassportRecord> {
  const res = await api(`/v1/identity/passports/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
  const json = (await res.json().catch(() => ({}))) as PassportRecord & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `passport_revoke_${res.status}`);
  return json;
}
