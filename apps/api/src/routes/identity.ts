import { Hono } from "hono";
import { QUERY_TYPES, parseDid, parseErc8004, parseMandate, type QueryType } from "@hop/shared";
import { loadConfig } from "../config.js";
import {
  bindPassportMandate,
  getPassport,
  issuePassport,
  listPassports,
  parseMandateBody,
  revokePassport,
} from "../passport-store.js";

function isQueryType(value: string): value is QueryType {
  return (QUERY_TYPES as readonly string[]).includes(value);
}

function publicPassport(row: {
  id: string;
  agent_id: string;
  capabilities: string[];
  issued_at: string;
  expires_at: string;
  policy_root: string;
  status: string;
  revoked_at?: string;
  did?: string;
  erc8004?: { agent_id: number; agent_registry: string };
}) {
  return {
    id: row.id,
    agent_id: row.agent_id,
    capabilities: row.capabilities,
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    policy_root: row.policy_root,
    status: row.status,
    revoked_at: row.revoked_at,
    did: row.did,
    erc8004: row.erc8004,
  };
}

export const identity = new Hono();

identity.get("/passports", (c) => {
  const cfg = loadConfig();
  if (!cfg.passportSecret) return c.json({ error: "identity_unconfigured" }, 503);
  return c.json({
    items: listPassports().map(publicPassport),
    required: cfg.passportRequired,
  });
});

identity.get("/passports/:id", (c) => {
  const cfg = loadConfig();
  if (!cfg.passportSecret) return c.json({ error: "identity_unconfigured" }, 503);
  const row = getPassport(c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(publicPassport(row));
});

identity.post("/passports", async (c) => {
  const cfg = loadConfig();
  if (!cfg.passportSecret) return c.json({ error: "identity_unconfigured" }, 503);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const agentId = String(body?.agent_id ?? "").trim();
  if (!agentId) return c.json({ error: "bad_agent_id" }, 400);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.map(String).filter(isQueryType)
    : undefined;
  const mandate = parseMandateBody(body?.mandate) ?? parseMandate(cfg.mandateJson);
  const ttlMs = Math.max(60_000, Number(body?.ttl_ms ?? cfg.passportTtlMs) || cfg.passportTtlMs);
  const did = parseDid(typeof body?.did === "string" ? body.did : undefined);
  if (did && "error" in did) return c.json({ error: "did_invalid" }, 400);
  const erc8004 = parseErc8004(body?.erc8004);
  if (erc8004 && "error" in erc8004) return c.json({ error: "erc8004_invalid" }, 400);
  const issued = await issuePassport({
    secret: cfg.passportSecret,
    agentId,
    capabilities,
    ttlMs,
    mandate: mandate?.agent_id === agentId ? mandate : null,
    did: did?.did,
    erc8004: erc8004?.erc8004,
  });
  return c.json(
    {
      passport: issued.record,
      token: issued.token,
      header: "X-Hop-Passport",
    },
    201,
  );
});

identity.post("/passports/:id/bind", async (c) => {
  const cfg = loadConfig();
  if (!cfg.passportSecret) return c.json({ error: "identity_unconfigured" }, 503);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const mandate = parseMandateBody(body?.mandate) ?? parseMandate(cfg.mandateJson);
  if (!mandate) return c.json({ error: "bad_mandate" }, 400);
  const bound = await bindPassportMandate(c.req.param("id"), mandate, cfg.passportSecret);
  if (!bound) return c.json({ error: "not_found" }, 404);
  return c.json({ passport: bound.record, token: bound.token });
});

identity.post("/passports/:id/revoke", async (c) => {
  const cfg = loadConfig();
  if (!cfg.passportSecret) return c.json({ error: "identity_unconfigured" }, 503);
  const row = await revokePassport(c.req.param("id"));
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({
    id: row.id,
    status: row.status,
    revoked_at: row.revoked_at,
  });
});
