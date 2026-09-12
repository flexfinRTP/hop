import { hashJson } from "./hash.js";

const BLOCKED_KEYS = new Set([
  "caps",
  "cap",
  "threshold",
  "policy_table",
  "op",
  "account",
  "account_id",
  "accounts",
]);

export function metricHash(metric: string): string {
  return hashJson({ metric });
}

export function dropCapKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key) || key === "metric") continue;
    out[key] = item;
  }
  return out;
}

/** Public hop JSON only. Caps, Account.id, and metric names never leave. */
export function sanitizeAggregate(
  aggregate: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!aggregate) return undefined;
  const json = JSON.stringify(aggregate);
  if (/0x[a-fA-F0-9]{40}/.test(json) && /account/i.test(json)) {
    return { error: "sanitized" };
  }
  const next = dropCapKeys(aggregate);
  if (typeof aggregate.metric === "string" && typeof next.metric_hash !== "string") {
    next.metric_hash = metricHash(aggregate.metric);
  }
  return next;
}

export function hashAggregate(aggregate: Record<string, unknown> | undefined): string {
  return hashJson(aggregate ?? { omitted: true });
}

export function creCommitment(input: {
  status: string;
  policy_hash: string;
  aggregate_hash: string;
  k_anon: unknown;
  graph: unknown;
}): Record<string, unknown> {
  return {
    status: input.status,
    policy_hash: input.policy_hash,
    aggregate_hash: input.aggregate_hash,
    k_anon: input.k_anon,
    graph: input.graph,
  };
}
