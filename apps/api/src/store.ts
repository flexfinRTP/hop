import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  hashJson,
  redactTrace,
  type Evidence,
  type MandateSpend,
  type PaymentRequirements,
  type TraceEvent,
} from "@hop/shared";
import {
  claimDurableRequest,
  completeHcsOutbox,
  databaseReady,
  enqueueHcsEvidence,
  initDatabase,
  loadDurableEvidence,
  persistDurableEvidence,
  releaseDurableClaim,
  takeHcsOutbox,
  updateDurableClaim,
} from "./database.js";

export {
  claimDurableRequest,
  completeHcsOutbox,
  enqueueHcsEvidence,
  releaseDurableClaim,
  takeHcsOutbox,
  updateDurableClaim,
};

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
const idempotencyInFlight = new Map<
  string,
  { bodyHash: string; wait: Promise<void>; release: () => void }
>();
const paymentInFlight = new Map<string, string>();
const demoQuotes = new Map<string, { expiresAt: number; count: number }>();

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

export async function initStore(
  evidenceDir: string,
  evidenceTtlMs: number,
  databaseUrl = "",
  databaseSsl = false,
): Promise<void> {
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
  if (databaseUrl) {
    await initDatabase(databaseUrl, { ssl: databaseSsl });
    const durable = await loadDurableEvidence(ttlMs);
    for (const item of durable) {
      if (!item || typeof item !== "object") continue;
      try {
        remember(item as StoredEvidence);
      } catch {
        continue;
      }
    }
  }
  persistReady = true;
  await loadMandates();
}

export function storeHealth(): { mode: "postgres" | "file"; durable: boolean } {
  return databaseReady()
    ? { mode: "postgres", durable: true }
    : { mode: "file", durable: false };
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

export function listEvidence(limit = 50): Evidence[] {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return [...byId.values()]
    .sort((a, b) => b.storedAt - a.storedAt)
    .slice(0, safeLimit)
    .map((row) => row.json);
}

export function getByIdempotency(key: string): StoredEvidence | undefined {
  const id = byIdempotency.get(key);
  return id ? byId.get(id) : undefined;
}

export function claimIdempotency(
  key: string,
  bodyHash: string,
):
  | { status: "acquired" }
  | { status: "conflict" }
  | { status: "pending"; wait: Promise<void> } {
  const current = idempotencyInFlight.get(key);
  if (current) {
    return current.bodyHash === bodyHash
      ? { status: "pending", wait: current.wait }
      : { status: "conflict" };
  }
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  idempotencyInFlight.set(key, { bodyHash, wait, release });
  return { status: "acquired" };
}

export function releaseIdempotency(key: string): void {
  const current = idempotencyInFlight.get(key);
  if (!current) return;
  idempotencyInFlight.delete(key);
  current.release();
}

export function hasEvidenceChainHash(hash: string): boolean {
  if (hash === "0".repeat(64)) return true;
  return [...byId.values()].some((row) => row.json.chain?.hash === hash);
}

export function rememberDemoQuote(requirement: PaymentRequirements, ttlMs = 120_000): void {
  const key = hashJson(requirement);
  const current = demoQuotes.get(key);
  demoQuotes.set(key, {
    expiresAt: Date.now() + ttlMs,
    count: (current?.expiresAt ?? 0) > Date.now() ? current!.count + 1 : 1,
  });
}

export function consumeDemoQuote(requirement: PaymentRequirements): boolean {
  const key = hashJson(requirement);
  const current = demoQuotes.get(key);
  if (!current || current.expiresAt < Date.now() || current.count < 1) {
    demoQuotes.delete(key);
    return false;
  }
  if (current.count === 1) demoQuotes.delete(key);
  else demoQuotes.set(key, { ...current, count: current.count - 1 });
  return true;
}

export function paymentReplay(paymentHash: string, idem: string): "ok" | "replay" {
  const prev = byPayment.get(paymentHash);
  if (!prev) return "ok";
  if (prev === idem) return "ok";
  return "replay";
}

export function claimPayment(paymentHash: string, idem: string): "ok" | "replay" {
  if (paymentReplay(paymentHash, idem) === "replay") return "replay";
  const pending = paymentInFlight.get(paymentHash);
  if (pending && pending !== idem) return "replay";
  paymentInFlight.set(paymentHash, idem);
  return "ok";
}

export function releasePayment(paymentHash: string, idem: string): void {
  if (paymentInFlight.get(paymentHash) === idem) {
    paymentInFlight.delete(paymentHash);
  }
}

export async function put(row: StoredEvidence): Promise<void> {
  const stored: StoredEvidence = { ...row, storedAt: row.storedAt ?? Date.now() };
  remember(stored);
  const writes: Promise<unknown>[] = [];
  if (persistReady && dir) {
    const file = path.join(dir, `${stored.id}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    writes.push(
      writeFile(tmp, JSON.stringify(stored), "utf8").then(async () => {
        try {
          await rename(tmp, file);
        } catch {
          await unlink(file).catch(() => undefined);
          await rename(tmp, file);
        }
      }),
    );
  }
  writes.push(
    persistDurableEvidence({
      id: stored.id,
      idempotencyKey: stored.idempotencyKey,
      bodyHash: stored.bodyHash,
      paymentHash: stored.paymentHash,
      payload: stored,
      storedAt: stored.storedAt,
    }),
  );
  await Promise.all(writes);
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

export function reserveMandate(mandateId: string, amount: number, now: number): string {
  const prev = getSpend(mandateId);
  const reservationId = randomUUID();
  const next: MandateSpend = {
    spent_tinybars: prev.spent_tinybars + amount,
    hops: [
      ...prev.hops.filter((h) => h.t > now - 24 * 3600 * 1000),
      { t: now, reservation_id: reservationId, amount_tinybars: amount },
    ],
  };
  mandateSpend.set(mandateId, next);
  void persistMandates();
  return reservationId;
}

export function releaseMandate(mandateId: string, reservationId: string): void {
  const prev = getSpend(mandateId);
  const reservation = prev.hops.find((hop) => hop.reservation_id === reservationId);
  if (!reservation) return;
  const amount = reservation.amount_tinybars ?? 0;
  mandateSpend.set(mandateId, {
    spent_tinybars: Math.max(0, prev.spent_tinybars - amount),
    hops: prev.hops.filter((hop) => hop.reservation_id !== reservationId),
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
  const ev: TraceEvent = { t: new Date().toISOString(), rail, msg: redactTrace(msg) };
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
