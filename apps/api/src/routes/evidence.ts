import { Hono } from "hono";
import {
  chainHash,
  decisionReceiptFromEvidence,
  evaluateCreStructural,
  hashJson,
  peacFromEvidence,
  peacHash,
  verificationTiers,
} from "@hop/shared";
import { loadConfig } from "../config.js";
import { verifyEvidenceExternally } from "../hedera-mirror.js";
import { getById, hasEvidenceChainHash, isId, listEvidence, put } from "../store.js";

export const evidence = new Hono();

evidence.get("/", (c) => {
  const requested = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(requested) ? requested : 50;
  const items = listEvidence(limit);
  return c.json({ items, count: items.length });
});

evidence.get("/:id/peac", (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(peacFromEvidence(row.json));
});

evidence.get("/:id/verify", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  const expected = hashJson(row.aggregate ?? { omitted: true });
  const aggregate_ok = expected === row.json.aggregate_hash;
  const prev = row.json.chain?.prev;
  const expectedChain =
    typeof prev === "string"
      ? chainHash({
          id: row.json.id,
          aggregate_hash: row.json.aggregate_hash,
          settlement: row.json.settlement.ref,
          prev,
          mandate_hash: row.json.mandate?.hash,
        })
      : "";
  const chain_ok = Boolean(expectedChain) && expectedChain === row.json.chain?.hash;
  const predecessor_ok = typeof prev === "string" && hasEvidenceChainHash(prev);
  const expectedPeac = peacHash(peacFromEvidence(row.json));
  const peac_ok = Boolean(row.json.peac_hash) && expectedPeac === row.json.peac_hash;
  const cre_ok = evaluateCreStructural(row.json.cre);
  const settlement_ref_present = Boolean(row.json.settlement.ref);
  const cachedAt = Date.parse(row.json.verification?.checked_at ?? "");
  const refresh = c.req.query("refresh") === "1";
  const external =
    !refresh && Number.isFinite(cachedAt) && Date.now() - cachedAt < 60_000
      ? row.json.verification
      : await verifyEvidenceExternally(loadConfig(), row.json);
  if (external && external !== row.json.verification) {
    row.json.verification = external;
    await put(row);
  }
  const externalSettlement = Boolean(external?.settlement.verified);
  const hcs_present = row.json.hcs_seq !== undefined;
  const externalHcs = hcs_present ? Boolean(external?.hcs?.verified) : true;
  const ranked = verificationTiers({
    aggregate_ok,
    chain_ok,
    predecessor_ok,
    peac_ok,
    cre_ok,
    cre_mode: row.json.cre?.mode,
    settlement_confirmed: externalSettlement,
    hcs_present,
    hcs_confirmed: externalHcs,
  });
  return c.json({
    ok:
      aggregate_ok &&
      chain_ok &&
      predecessor_ok &&
      peac_ok &&
      cre_ok &&
      settlement_ref_present &&
      externalSettlement &&
      externalHcs,
    tiers: ranked.tiers,
    ok_means: ranked.ok_means,
    cre_ok_means: ranked.cre_ok_means,
    hcs_present: ranked.hcs_present,
    aggregate_ok,
    chain_ok,
    predecessor_ok,
    peac_ok,
    cre_ok,
    settlement_ref_present,
    external_settlement_verified: externalSettlement,
    external_hcs_verified: externalHcs,
    verification: external,
    id: row.json.id,
    settlement: row.json.settlement.ref,
    peac_hash: row.json.peac_hash,
    hcs_seq: row.json.hcs_seq,
    cre: row.json.cre,
    world: row.json.world,
    receipt: decisionReceiptFromEvidence(row.json, {
      semantics: "attempt",
      settled: Boolean(row.json.settlement.ref),
    }),
  });
});

evidence.get("/:id", (c) => {
  const id = c.req.param("id");
  if (!isId(id)) return c.json({ error: "not_found" }, 404);
  const row = getById(id);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row.json);
});
