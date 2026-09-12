import { hashJson } from "./hash.js";
import { QUERY_TYPES, type QueryType } from "./types.js";

export const DEFAULT_MANDATE_JSON =
  '{"id":"desk-1","agent_id":"workbench","max_tinybars":5000000,"max_hops":40,"window_s":3600,"expires_at":"2027-01-01T00:00:00Z","pay_to":"","queries":["policy_check","market_params","position_counts","liquidations","account_ltv"],"max_block_lag":500,"human_threshold_tinybars":0}';

export type Mandate = {
  id: string;
  agent_id: string;
  max_tinybars: number;
  per_call_tinybars?: number;
  max_hops: number;
  window_s: number;
  expires_at: string;
  pay_to: string;
  queries: QueryType[];
  max_block_lag: number;
  human_threshold_tinybars: number;
};

export type MandateDecision = {
  result: "ALLOW" | "DENY" | "REVIEW";
  reason: string;
  mandate_hash: string;
  remaining_tinybars: number;
  remaining_hops: number;
};

export type MandateSpend = {
  spent_tinybars: number;
  hops: { t: number }[];
};

export type MandateContext = {
  payTo: string;
  amountTinybars: number;
  query: QueryType;
  maxBlockLag: number;
  now: number;
  spentTinybars: number;
  hopsInWindow: number;
  confirmed: boolean;
};

export function parseMandate(raw: string | undefined | null): Mandate | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    if (trimmed.startsWith("{")) {
      parsed = JSON.parse(trimmed);
    } else {
      const maybeB64 = Buffer.from(trimmed, "base64").toString("utf8");
      parsed = JSON.parse(maybeB64.startsWith("{") ? maybeB64 : trimmed);
    }
  } catch {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const agent_id = String(row.agent_id ?? "").trim();
  const max_tinybars = Number(row.max_tinybars);
  const max_hops = Number(row.max_hops);
  const window_s = Number(row.window_s);
  const expires_at = String(row.expires_at ?? "").trim();
  const pay_to = String(row.pay_to ?? "").trim();
  const max_block_lag = Number(row.max_block_lag);
  const human_threshold_tinybars = Number(row.human_threshold_tinybars ?? 0);
  const queries = Array.isArray(row.queries)
    ? row.queries.map(String).filter((q): q is QueryType => (QUERY_TYPES as readonly string[]).includes(q))
    : [...QUERY_TYPES];
  if (!id || !agent_id) return null;
  if (!Number.isFinite(max_tinybars) || max_tinybars < 0) return null;
  if (!Number.isFinite(max_hops) || max_hops < 1) return null;
  if (!Number.isFinite(window_s) || window_s < 1) return null;
  if (!expires_at || Number.isNaN(Date.parse(expires_at))) return null;
  if (!Number.isFinite(max_block_lag) || max_block_lag < 0) return null;
  if (queries.length < 1) return null;
  const per = row.per_call_tinybars === undefined ? undefined : Number(row.per_call_tinybars);
  if (per !== undefined && (!Number.isFinite(per) || per < 0)) return null;
  return {
    id,
    agent_id,
    max_tinybars,
    per_call_tinybars: per,
    max_hops,
    window_s,
    expires_at,
    pay_to,
    queries,
    max_block_lag,
    human_threshold_tinybars: Number.isFinite(human_threshold_tinybars) ? human_threshold_tinybars : 0,
  };
}

export function mandateHash(mandate: Mandate): string {
  return hashJson(mandate);
}

export function evaluateMandate(mandate: Mandate, ctx: MandateContext): MandateDecision {
  const hash = mandateHash(mandate);
  const remaining_tinybars = Math.max(0, mandate.max_tinybars - ctx.spentTinybars);
  const remaining_hops = Math.max(0, mandate.max_hops - ctx.hopsInWindow);
  const deny = (reason: string): MandateDecision => ({
    result: "DENY",
    reason,
    mandate_hash: hash,
    remaining_tinybars,
    remaining_hops,
  });

  if (Date.parse(mandate.expires_at) <= ctx.now) return deny("mandate_expired");
  if (mandate.pay_to && mandate.pay_to !== ctx.payTo) return deny("mandate_merchant");
  if (!mandate.queries.includes(ctx.query)) return deny("mandate_query");
  if (ctx.maxBlockLag > mandate.max_block_lag) return deny("mandate_freshness");
  if (mandate.per_call_tinybars !== undefined && ctx.amountTinybars > mandate.per_call_tinybars) {
    return deny("mandate_per_call");
  }
  if (ctx.amountTinybars > remaining_tinybars) return deny("mandate_budget");
  if (remaining_hops < 1) return deny("mandate_velocity");
  if (mandate.human_threshold_tinybars > 0 && ctx.amountTinybars >= mandate.human_threshold_tinybars && !ctx.confirmed) {
    return {
      result: "REVIEW",
      reason: "mandate_review",
      mandate_hash: hash,
      remaining_tinybars,
      remaining_hops,
    };
  }
  return {
    result: "ALLOW",
    reason: "mandate_allow",
    mandate_hash: hash,
    remaining_tinybars: remaining_tinybars - ctx.amountTinybars,
    remaining_hops: remaining_hops - 1,
  };
}

export function encodeMandateHeader(mandate: Mandate): string {
  return Buffer.from(JSON.stringify(mandate)).toString("base64");
}
