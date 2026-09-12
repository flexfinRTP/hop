import { Hono } from "hono";

/** GET /v1/evidence/{id} — hashes only. No Account.id. No policy caps. */
export const evidence = new Hono();

evidence.get("/:id", (c) => {
  return c.json({ error: "not_implemented", id: c.req.param("id") }, 501);
});
