import type { HopJoinResult, HopReason, QueryStatus } from "./types.js";

export function hopReason(joined: HopJoinResult): HopReason {
  const freshness: HopReason["freshness"] =
    joined.status === "stale" || joined.graph.deployments.length < 1 ? "stale" : "live";
  const agg = joined.aggregate ?? {};
  const metric_hash = typeof agg.metric_hash === "string" ? agg.metric_hash : undefined;
  const observed = typeof agg.observed === "number" ? agg.observed : undefined;
  return {
    stamp: stampFor(joined.status, agg.breached === true),
    metric_hash,
    observed,
    freshness,
  };
}

function stampFor(status: QueryStatus, breached: boolean): string {
  if (status === "stale") return "stale";
  if (status === "k_anon_denied") return "k_anon_denied";
  if (status === "reject" || breached) return "over";
  return "not over";
}
