import { LABELS, type WallView } from "./types.js";

export function wallFromAggregate(
  aggregate: Record<string, unknown> | undefined,
  buffer: number,
): WallView {
  const observed = observedNumber(aggregate);
  return {
    sleeve: observed > buffer ? "surplus" : "cash",
    buffer,
    observed,
    ats: LABELS.ats,
    graph_pull: false,
    x402: false,
  };
}

function observedNumber(aggregate: Record<string, unknown> | undefined): number {
  if (!aggregate) return 0;
  if (typeof aggregate.observed === "number") return aggregate.observed;
  const protocols = aggregate.protocols;
  if (Array.isArray(protocols) && protocols[0] && typeof protocols[0] === "object") {
    const util = (protocols[0] as { utilization?: unknown }).utilization;
    if (typeof util === "number") return util;
  }
  return 0;
}
