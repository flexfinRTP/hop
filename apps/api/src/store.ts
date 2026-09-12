import { randomUUID } from "node:crypto";
import type { Evidence, TraceEvent } from "@hop/shared";

export type StoredEvidence = {
  id: string;
  idempotencyKey?: string;
  bodyHash?: string;
  json: Evidence;
  aggregate?: Record<string, unknown>;
  settled: boolean;
};

const byId = new Map<string, StoredEvidence>();
const byIdempotency = new Map<string, string>();
const traces = new Map<string, TraceEvent[]>();
const listeners = new Map<string, Set<(ev: TraceEvent) => void>>();

export function newId(): string {
  return randomUUID();
}

export function getById(id: string): StoredEvidence | undefined {
  return byId.get(id);
}

export function getByIdempotency(key: string): StoredEvidence | undefined {
  const id = byIdempotency.get(key);
  return id ? byId.get(id) : undefined;
}

export function put(row: StoredEvidence): void {
  byId.set(row.id, row);
  if (row.idempotencyKey) byIdempotency.set(row.idempotencyKey, row.id);
}

export function emit(traceId: string | undefined, rail: TraceEvent["rail"], msg: string): TraceEvent {
  const ev: TraceEvent = { t: new Date().toISOString(), rail, msg };
  if (!traceId) return ev;
  const list = traces.get(traceId) ?? [];
  list.push(ev);
  traces.set(traceId, list);
  for (const fn of listeners.get(traceId) ?? []) fn(ev);
  return ev;
}

export function getTrace(traceId: string): TraceEvent[] {
  return traces.get(traceId) ?? [];
}

export function onTrace(traceId: string, fn: (ev: TraceEvent) => void): () => void {
  const set = listeners.get(traceId) ?? new Set();
  set.add(fn);
  listeners.set(traceId, set);
  return () => {
    set.delete(fn);
  };
}
