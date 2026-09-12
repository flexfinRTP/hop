import { Hono } from "hono";

/**
 * POST /v1/query — next: unpaid → 402 (live feePayer from Blocky402 GET /supported),
 * then ExactHederaScheme retry with X-PAYMENT + Idempotency-Key, then CRE handlerInTee.
 * Charge table lives in @hop/shared CHARGE.
 */
export const query = new Hono();

query.post("/", (c) => {
  return c.json({ error: "not_implemented" }, 501);
});
