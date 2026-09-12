import { Hono } from "hono";
import { hashJson, peacFromEvidence } from "@hop/shared";
import { getById, isId } from "../store.js";

export const evidence = new Hono();

evidence.get("/:id/peac", (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(peacFromEvidence(row.json));
});

evidence.get("/:id/verify", (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  const expected = hashJson(row.aggregate ?? { omitted: true });
  const aggregate_ok = expected === row.json.aggregate_hash;
  const prev = row.json.chain?.prev;
  const chain_ok = Boolean(row.json.chain?.hash) && typeof prev === "string";
  const cre_ok = Boolean(row.json.cre?.trigger === "http" && row.json.cre?.tee);
  return c.json({
    ok: aggregate_ok && chain_ok,
    aggregate_ok,
    chain_ok,
    cre_ok,
    id: row.json.id,
    settlement: row.json.settlement.ref,
    peac_hash: row.json.peac_hash,
    hcs_seq: row.json.hcs_seq,
    cre: row.json.cre,
    world: row.json.world,
  });
});

evidence.get("/:id", (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row.json);
});
