import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashJson, type Evidence, type MandateSpend, type TraceEvent } from "@hop/shared";

export type StoredEvidence = {
  id: string;
  idempotencyKey?: string;
  bodyHash?: string;
  paymentHash?: string;
  json: Evidence;
  aggregate?: Record<string, unknown>;
  settled: boolean;
  storedAt: number;
};

const byId = new Map<string, StoredEvidence>();
const byIdempotency = new Map<string, string>();
const byPayment = new Map<string, string>();
const traces = new Map<string, TraceEvent[]>();
const listeners = new Map<string, Set<(ev: TraceEvent) => void>>();
const mandateSpend = new Map<string, MandateSpend>();

let dir = "";
let ttlMs = 72 * 3600 * 1000;
let persistReady = false;
let chainHead = "0".repeat(64);
let chainId = "";

export function newId(): string {
  return randomUUID();
}

export function isId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function initStore(evidenceDir: string, evidenceTtlMs: number): Promise<void> {
  dir = evidenceDir;
  ttlMs = evidenceTtlMs;
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir).catch(() => []);
  const now = Date.now();
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(path.join(dir, file), "utf8").catch(() => "");
    if (!raw) continue;
    try {
      const row = JSON.parse(raw) as StoredEvidence;
      if (now - (row.storedAt ?? 0) > ttlMs) {
        await unlink(path.join(dir, file)).catch(() => undefined);
        continue;
      }
      remember(row);
    } catch {
      continue;
    }
  }
  persistReady = true;
  await loadMandates();
}

function remember(row: StoredEvidence): void {
  byId.set(row.id, row);
  if (row.idempotencyKey) byIdempotency.set(row.idempotencyKey, row.id);
  if (row.paymentHash) byPayment.set(row.paymentHash, row.idempotencyKey ?? row.id);
  const hash = row.json.chain?.hash;
  if (hash && (row.storedAt ?? 0) >= (byId.get(chainId)?.storedAt ?? 0)) {
    chainHead = hash;
    chainId = row.id;
  }
}

export function getById(id: string): StoredEvidence | undefined {
  if (!isId(id)) return undefined;
  return byId.get(id);
}

export function getByIdempotency(key: string): StoredEvidence | undefined {
  const id = byIdempotency.get(key);
  return id ? byId.get(id) : undefined;
}

export function paymentReplay(paymentHash: string, idem: string): "ok" | "replay" {
  const prev = byPayment.get(paymentHash);
  if (!prev) return "ok";
  if (prev === idem) return "ok";
  return "replay";
}

export async function put(row: StoredEvidence): Promise<void> {
  const stored: StoredEvidence = { ...row, storedAt: row.storedAt ?? Date.now() };
  remember(stored);
  if (!persistReady || !dir) return;
  const file = path.join(dir, `${stored.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(stored), "utf8");
  try {
    await rename(tmp, file);
  } catch {
    await unlink(file).catch(() => undefined);
    await rename(tmp, file);
  }
}

export function currentChain(): { prev: string; id: string } {
  return { prev: chainHead, id: chainId };
}

export function getSpend(mandateId: string): MandateSpend {
  return mandateSpend.get(mandateId) ?? { spent_tinybars: 0, hops: [] };
}

export function hopsInWindow(mandateId: string, windowS: number, now: number): number {
  const cutoff = now - windowS * 1000;
  return getSpend(mandateId).hops.filter((h) => h.t > cutoff).length;
}

export function reserveMandate(mandateId: string, amount: number, now: number): MandateSpend {
  const prev = getSpend(mandateId);
  const next: MandateSpend = {
    spent_tinybars: prev.spent_tinybars + amount,
    hops: [...prev.hops.filter((h) => h.t > now - 24 * 3600 * 1000), { t: now }],
  };
  mandateSpend.set(mandateId, next);
  void persistMandates();
  return next;
}

export function releaseMandate(mandateId: string, amount: number): void {
  const prev = getSpend(mandateId);
  const hops = prev.hops.slice(0, -1);
  mandateSpend.set(mandateId, {
    spent_tinybars: Math.max(0, prev.spent_tinybars - amount),
    hops,
  });
  void persistMandates();
}

function mandatesFile(): string {
  return path.join(dir, "..", "mandates.json");
}

async function loadMandates(): Promise<void> {
  const raw = await readFile(mandatesFile(), "utf8").catch(() => "");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, MandateSpend>;
    for (const [id, spend] of Object.entries(parsed)) {
      if (spend && typeof spend.spent_tinybars === "number") {
        mandateSpend.set(id, { spent_tinybars: spend.spent_tinybars, hops: spend.hops ?? [] });
      }
    }
  } catch {
    return;
  }
}

async function persistMandates(): Promise<void> {
  if (!persistReady || !dir) return;
  const obj: Record<string, MandateSpend> = {};
  for (const [id, spend] of mandateSpend) obj[id] = spend;
  const file = mandatesFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(obj), "utf8");
}

export function paymentHashOf(payload: unknown): string {
  return hashJson(payload);
}

export function emit(traceId: string | undefined, rail: TraceEvent["rail"], msg: string): TraceEvent {
  const ev: TraceEvent = { t: new Date().toISOString(), rail, msg: redact(msg) };
  if (!traceId) return ev;
  const list = traces.get(traceId) ?? [];
  list.push(ev);
  traces.set(traceId, list);
  for (const fn of listeners.get(traceId) ?? []) fn(ev);
  return ev;
}

function redact(msg: string): string {
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted]")
    .replace(/\b302[a-eA-E][0-9a-fA-F]{60,}\b/g, "[redacted-key]");
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
