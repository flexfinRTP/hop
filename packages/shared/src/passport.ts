import { keyedHashJson } from "./hash.js";
import { QUERY_TYPES, type QueryType } from "./types.js";
import type { ReasonCode } from "./decision.js";

export const PASSPORT_TOKEN_PREFIX = "h1" as const;

export type PassportStatus = "active" | "revoked";

export type PassportPayload = {
  id: string;
  agent_id: string;
  capabilities: QueryType[];
  issued_at: string;
  expires_at: string;
  policy_root: string;
};

export type PassportRecord = PassportPayload & {
  status: PassportStatus;
  revoked_at?: string;
};

function b64urlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(value, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

function macEq(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mix = 0;
  for (let i = 0; i < left.length; i += 1) mix |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mix === 0;
}

export function signPassport(secret: string, payload: PassportPayload): string {
  if (!secret) throw new Error("passport_secret_required");
  const mac = keyedHashJson(secret, payload);
  return `${PASSPORT_TOKEN_PREFIX}.${b64urlEncode(JSON.stringify(payload))}.${mac}`;
}

export function parsePassportToken(
  secret: string,
  token: string,
): PassportPayload | { error: ReasonCode } {
  if (!secret) return { error: "passport_invalid" };
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PASSPORT_TOKEN_PREFIX) return { error: "passport_invalid" };
  const body = parts[1] ?? "";
  const mac = parts[2] ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(b64urlDecode(body));
  } catch {
    return { error: "passport_invalid" };
  }
  if (!parsed || typeof parsed !== "object") return { error: "passport_invalid" };
  const row = parsed as Record<string, unknown>;
  const capabilities = Array.isArray(row.capabilities)
    ? row.capabilities
        .map(String)
        .filter((item): item is QueryType => (QUERY_TYPES as readonly string[]).includes(item))
    : [];
  const payload: PassportPayload = {
    id: String(row.id ?? "").trim(),
    agent_id: String(row.agent_id ?? "").trim(),
    capabilities,
    issued_at: String(row.issued_at ?? "").trim(),
    expires_at: String(row.expires_at ?? "").trim(),
    policy_root: String(row.policy_root ?? "").trim(),
  };
  if (!payload.id || !payload.agent_id || capabilities.length < 1) return { error: "passport_invalid" };
  if (!payload.issued_at || !payload.expires_at) return { error: "passport_invalid" };
  const expected = keyedHashJson(secret, payload);
  if (!macEq(expected, mac)) return { error: "passport_invalid" };
  return payload;
}

export function passportExpired(payload: PassportPayload, now = Date.now()): boolean {
  return Date.parse(payload.expires_at) <= now;
}
