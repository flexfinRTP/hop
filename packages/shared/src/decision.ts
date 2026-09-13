import type { QueryStatus } from "./types.js";

export const VERDICTS = ["ALLOW", "HOLD", "DENY", "REVIEW"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const REASON_CODES = [
  "policy_clear",
  "policy_breached",
  "stale_block",
  "k_anon",
  "mandate_allow",
  "mandate_expired",
  "mandate_merchant",
  "mandate_query",
  "mandate_freshness",
  "mandate_per_call",
  "mandate_budget",
  "mandate_velocity",
  "mandate_review",
  "mandate_required",
  "passport_required",
  "passport_invalid",
  "passport_revoked",
  "passport_expired",
  "passport_capability",
  "passport_mandate",
  "passport_agent",
  "payer_denied",
  "world_required",
  "cre_unavailable",
  "policy_unavailable",
  "graph_unconfigured",
  "facilitator_unavailable",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export type Screening = {
  ofac: "not_screened";
  kyc: "not_performed";
  world: "off" | "unique_human";
};

export type IdentityReceipt = {
  passport_id: string;
  agent_id: string;
  policy_root: string;
};

export type GateBody = {
  error: string;
  verdict: Verdict;
  reason_code: ReasonCode;
  screening: Screening;
  remaining_tinybars?: number;
  remaining_hops?: number;
  consumer_prompt?: string;
  identity?: IdentityReceipt;
  mandate?: unknown;
};

export function screeningFor(world: Screening["world"] = "off"): Screening {
  return { ofac: "not_screened", kyc: "not_performed", world };
}

export function verdictFromQueryStatus(status: QueryStatus): Verdict {
  if (status === "accept") return "ALLOW";
  if (status === "k_anon_denied") return "DENY";
  return "HOLD";
}

export function reasonCodeFromQueryStatus(status: QueryStatus): ReasonCode {
  if (status === "accept") return "policy_clear";
  if (status === "reject") return "policy_breached";
  if (status === "stale") return "stale_block";
  return "k_anon";
}

export function isReasonCode(value: string): value is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value);
}

export function gateBody(input: {
  error: string;
  verdict: Verdict;
  reason_code: ReasonCode;
  world?: Screening["world"];
  remaining_tinybars?: number;
  remaining_hops?: number;
  consumer_prompt?: string;
  identity?: IdentityReceipt;
  mandate?: unknown;
}): GateBody {
  return {
    error: input.error,
    verdict: input.verdict,
    reason_code: input.reason_code,
    screening: screeningFor(input.world),
    remaining_tinybars: input.remaining_tinybars,
    remaining_hops: input.remaining_hops,
    consumer_prompt: input.consumer_prompt,
    identity: input.identity,
    mandate: input.mandate,
  };
}
