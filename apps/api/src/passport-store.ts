import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  QUERY_TYPES,
  mandateHash,
  parseMandate,
  passportExpired,
  parsePassportToken,
  signPassport,
  type Mandate,
  type PassportPayload,
  type PassportRecord,
  type QueryType,
  type ReasonCode,
} from "@hop/shared";
import { loadPassports, persistPassport } from "./database.js";

const byId = new Map<string, PassportRecord>();
let dir = "";
let persistReady = false;

export function newPassportId(): string {
  return randomUUID();
}

export async function initPassportStore(evidenceDir: string): Promise<void> {
  dir = path.join(evidenceDir, "passports");
  await mkdir(dir, { recursive: true });
  const files = await readdir(dir).catch(() => []);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await readFile(path.join(dir, file), "utf8").catch(() => "");
    if (!raw) continue;
    try {
      const row = JSON.parse(raw) as PassportRecord;
      if (row?.id) byId.set(row.id, row);
    } catch {
      continue;
    }
  }
  const durable = await loadPassports().catch(() => []);
  for (const item of durable) {
    if (!item || typeof item !== "object") continue;
    const row = item as PassportRecord;
    if (row.id) byId.set(row.id, row);
  }
  persistReady = true;
}

function remember(row: PassportRecord): void {
  byId.set(row.id, row);
}

async function persist(row: PassportRecord): Promise<void> {
  remember(row);
  if (!persistReady || !dir) return;
  await writeFile(path.join(dir, `${row.id}.json`), JSON.stringify(row), "utf8").catch(() => undefined);
  await persistPassport({
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    payload: row,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }).catch(() => undefined);
}

export function listPassports(): PassportRecord[] {
  return [...byId.values()].sort((a, b) => a.issued_at.localeCompare(b.issued_at));
}

export function getPassport(id: string): PassportRecord | undefined {
  return byId.get(id);
}

export async function issuePassport(input: {
  secret: string;
  agentId: string;
  capabilities?: QueryType[];
  ttlMs: number;
  mandate?: Mandate | null;
  did?: string;
  erc8004?: PassportRecord["erc8004"];
}): Promise<{ record: PassportRecord; token: string }> {
  const capabilities =
    input.capabilities && input.capabilities.length > 0 ? input.capabilities : [...QUERY_TYPES];
  const issued = new Date();
  const record: PassportRecord = {
    id: newPassportId(),
    agent_id: input.agentId,
    capabilities,
    issued_at: issued.toISOString(),
    expires_at: new Date(issued.getTime() + input.ttlMs).toISOString(),
    policy_root: input.mandate ? mandateHash(input.mandate) : "",
    status: "active",
    did: input.did,
    erc8004: input.erc8004,
  };
  await persist(record);
  return { record, token: signPassport(input.secret, record) };
}

export async function bindPassportMandate(id: string, mandate: Mandate, secret: string): Promise<{
  record: PassportRecord;
  token: string;
} | undefined> {
  const current = byId.get(id);
  if (!current || current.status !== "active") return undefined;
  const next: PassportRecord = {
    ...current,
    policy_root: mandateHash(mandate),
    agent_id: mandate.agent_id || current.agent_id,
  };
  await persist(next);
  return {
    record: next,
    token: signPassport(secret, next),
  };
}

export async function revokePassport(id: string): Promise<PassportRecord | undefined> {
  const current = byId.get(id);
  if (!current) return undefined;
  const next: PassportRecord = {
    ...current,
    status: "revoked",
    revoked_at: new Date().toISOString(),
  };
  await persist(next);
  return next;
}

export async function dropPassportFile(id: string): Promise<void> {
  if (!dir) return;
  await unlink(path.join(dir, `${id}.json`)).catch(() => undefined);
}

export function resolvePassport(input: {
  secret: string;
  token: string;
  query?: QueryType;
  now?: number;
}): { record: PassportRecord; payload: PassportPayload } | { error: ReasonCode } {
  const parsed = parsePassportToken(input.secret, input.token);
  if ("error" in parsed) return parsed;
  const record = byId.get(parsed.id);
  if (!record) return { error: "passport_invalid" };
  if (record.status === "revoked") return { error: "passport_revoked" };
  if (passportExpired(parsed, input.now ?? Date.now())) return { error: "passport_expired" };
  if (input.query && !record.capabilities.includes(input.query)) {
    return { error: "passport_capability" };
  }
  return { record, payload: parsed };
}

export function parseMandateBody(raw: unknown): Mandate | null {
  if (!raw) return null;
  if (typeof raw === "string") return parseMandate(raw);
  if (typeof raw === "object") return parseMandate(JSON.stringify(raw));
  return null;
}
