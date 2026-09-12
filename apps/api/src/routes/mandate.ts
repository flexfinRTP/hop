import { Hono } from "hono";
import { evaluateMandate, parseMandate } from "@hop/shared";
import { loadConfig, quoteAmount } from "../config.js";
import { getSpend, hopsInWindow } from "../store.js";

export const mandate = new Hono();

mandate.get("/", (c) => {
  const cfg = loadConfig();
  const server = parseMandate(cfg.mandateJson);
  const header = c.req.header("X-Hop-Mandate") || c.req.header("x-hop-mandate");
  const client = header ? parseMandate(header) : null;
  if (header && !client) return c.json({ error: "bad_mandate" }, 400);
  const parsed = server
    ? { ...server, agent_id: client?.agent_id || server.agent_id }
    : client;
  if (!parsed) return c.json({ error: "mandate_missing" }, 404);
  const now = Date.now();
  const amount = Number(quoteAmount(cfg, 2));
  const bound = parsed.pay_to ? parsed : { ...parsed, pay_to: cfg.payTo };
  const decision = evaluateMandate(bound, {
    payTo: cfg.payTo,
    amountTinybars: amount,
    query: "policy_check",
    maxBlockLag: 50,
    now,
    spentTinybars: getSpend(bound.id).spent_tinybars,
    hopsInWindow: hopsInWindow(bound.id, bound.window_s, now),
    confirmed: true,
  });
  return c.json({
    id: bound.id,
    agent_id: bound.agent_id,
    spent_tinybars: getSpend(bound.id).spent_tinybars,
    remaining_tinybars: Math.max(0, bound.max_tinybars - getSpend(bound.id).spent_tinybars),
    remaining_hops: Math.max(0, bound.max_hops - hopsInWindow(bound.id, bound.window_s, now)),
    expires_at: bound.expires_at,
    inspect: decision.result,
    reason: decision.reason,
    hash: decision.mandate_hash,
  });
});
