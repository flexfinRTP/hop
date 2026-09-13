import { hashJson, keyedHashJson } from "./hash.js";
import type { PolicyCap, PolicyTable } from "./types.js";

export function parsePolicyTable(raw: string | undefined | null): PolicyTable | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed || trimmed === "{}") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const table = parsed as Partial<PolicyTable>;
  if (!table.version || !Array.isArray(table.caps) || table.caps.length === 0) {
    return null;
  }
  const caps = table.caps.filter(isPolicyCap);
  if (caps.length === 0) return null;
  return {
    version: table.version,
    k: typeof table.k === "number" && table.k > 0 ? table.k : 5,
    caps,
  };
}

function isPolicyCap(value: unknown): value is PolicyCap {
  if (!value || typeof value !== "object") return false;
  const cap = value as PolicyCap;
  const metrics = [
    "utilization",
    "tvl_usd",
    "liquidations_count",
    "liquidations_usd",
    "combined_utilization",
  ];
  const ops = ["gt", "gte", "lt", "lte"];
  return (
    metrics.includes(cap.metric) &&
    ops.includes(cap.op) &&
    typeof cap.value === "number" &&
    Number.isFinite(cap.value)
  );
}

export function thresholdHash(table: PolicyTable, commitmentKey?: string): string {
  const value = { version: table.version, caps: table.caps };
  return commitmentKey ? keyedHashJson(commitmentKey, value) : hashJson(value);
}

export function compare(op: PolicyCap["op"], observed: number, cap: number): boolean {
  switch (op) {
    case "gt":
      return observed > cap;
    case "gte":
      return observed >= cap;
    case "lt":
      return observed < cap;
    case "lte":
      return observed <= cap;
  }
}
