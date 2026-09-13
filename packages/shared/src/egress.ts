import { hashJson } from "./hash.js";

const BLOCKED_KEYS = new Set([
  "caps",
  "cap",
  "threshold",
  "thresholds",
  "policy_table",
  "policytable",
  "op",
  "account",
  "accountid",
  "account_id",
  "accounts",
]);

export function metricHash(metric: string): string {
  return hashJson({ metric });
}

export function dropCapKeys(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(value);
}

/** Public hop JSON only. Caps, Account.id, and metric names never leave. */
export function sanitizeAggregate(
  aggregate: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!aggregate) return undefined;
  const next = sanitizeRecord(aggregate);
  if (typeof aggregate.metric === "string" && typeof next.metric_hash !== "string") {
    next.metric_hash = metricHash(aggregate.metric);
  }
  return next;
}

function normalizedKey(key: string): string {
  return key.replace(/[-_\s]/g, "").toLowerCase();
}

function sanitizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (BLOCKED_KEYS.has(key.toLowerCase()) || BLOCKED_KEYS.has(normalized) || normalized === "metric") {
      continue;
    }
    out[key] = sanitizeValue(item);
  }
  return out;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  if (typeof value === "string" && /0x[a-fA-F0-9]{40}/.test(value)) {
    return "[redacted]";
  }
  return value;
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
