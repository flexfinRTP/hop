import { createHmac, createHash } from "node:crypto";
import { signRequest } from "@worldcoin/idkit-core/signing";
import type { AppConfig } from "./config.js";
import { postJson } from "./http.js";

const VERIFY_URL = "https://developer.world.org/api/v4/verify";
const TOKEN_TTL_S = 3600;

export type WorldSession = {
  nullifier_hash: string;
  exp: number;
};

function secret(cfg: AppConfig): string {
  return cfg.worldRpSigningKey || cfg.worldRpId;
}

function nullifierOf(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const row = result as Record<string, unknown>;
  if (typeof row.nullifier_hash === "string") return row.nullifier_hash;
  if (typeof row.nullifier === "string") return row.nullifier;
  const responses = row.responses;
  if (!Array.isArray(responses)) return undefined;
  for (const item of responses) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.nullifier === "string") return r.nullifier;
    if (typeof r.nullifier_hash === "string") return r.nullifier_hash;
    if (Array.isArray(r.session_nullifier) && typeof r.session_nullifier[0] === "string") {
      return r.session_nullifier[0];
    }
  }
  return undefined;
}

export function worldReady(cfg: AppConfig): boolean {
  return Boolean(cfg.worldAppId && cfg.worldRpId && cfg.worldRpSigningKey);
}

export function signWorldRequest(cfg: AppConfig, action: string): {
  rp_id: string;
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
} {
  if (!worldReady(cfg)) throw new Error("world_unconfigured");
  const signed = signRequest({
    signingKeyHex: cfg.worldRpSigningKey,
    action: action || cfg.worldAction,
  });
  return {
    rp_id: cfg.worldRpId,
    sig: signed.sig,
    nonce: signed.nonce,
    created_at: signed.createdAt,
    expires_at: signed.expiresAt,
  };
}

export function issueWorldToken(cfg: AppConfig, nullifierHash: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_S;
  const body = Buffer.from(JSON.stringify({ n: nullifierHash, exp })).toString("base64url");
  const mac = createHmac("sha256", secret(cfg)).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readWorldToken(cfg: AppConfig, token: string | undefined): WorldSession | undefined {
  if (!token || !worldReady(cfg)) return undefined;
  const [body, mac] = token.split(".");
  if (!body || !mac) return undefined;
  const expect = createHmac("sha256", secret(cfg)).update(body).digest("base64url");
  if (expect.length !== mac.length) return undefined;
  let ok = 0;
  for (let i = 0; i < expect.length; i++) ok |= expect.charCodeAt(i) ^ mac.charCodeAt(i);
  if (ok !== 0) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      n?: string;
      exp?: number;
    };
    if (typeof parsed.n !== "string" || typeof parsed.exp !== "number") return undefined;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return undefined;
    return { nullifier_hash: parsed.n, exp: parsed.exp };
  } catch {
    return undefined;
  }
}

export function hashNullifier(nullifierHash: string): string {
  return createHash("sha256").update(nullifierHash).digest("hex");
}

export async function verifyWorldProof(cfg: AppConfig, idkitResponse: unknown): Promise<string> {
  if (!worldReady(cfg)) throw new Error("world_unconfigured");
  const res = await postJson(
    `${VERIFY_URL}/${cfg.worldRpId}`,
    idkitResponse,
    {},
    20_000,
  );
  const json = JSON.parse(res.text) as { success?: boolean; code?: string; detail?: string };
  if (res.status >= 400 || json.success === false) {
    throw new Error(json.detail ?? json.code ?? `world_verify_${res.status}`);
  }
  const nullifier = nullifierOf(idkitResponse);
  if (!nullifier) throw new Error("world_nullifier_missing");
  return nullifier;
}
