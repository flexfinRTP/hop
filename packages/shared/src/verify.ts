import type { Evidence, VerificationTiers, VerifyMeans } from "./types.js";

const HEX64 = /^[a-f0-9]{64}$/i;

export function evaluateCreStructural(cre: Evidence["cre"] | undefined): boolean {
  if (!cre) return false;
  return (
    (cre.mode === "simulation" || cre.mode === "don") &&
    cre.trigger === "http" &&
    Boolean(cre.tee?.startsWith("nitro:")) &&
    cre.artifact === "handlerInTee" &&
    HEX64.test(cre.cre_commitment_hash ?? cre.report_hash ?? "")
  );
}

export function verificationTiers(input: {
  aggregate_ok: boolean;
  chain_ok: boolean;
  predecessor_ok: boolean;
  peac_ok: boolean;
  cre_ok: boolean;
  cre_mode?: Evidence["cre"]["mode"];
  settlement_confirmed: boolean;
  hcs_present: boolean;
  hcs_confirmed: boolean;
}): { tiers: VerificationTiers; hcs_present: boolean } & VerifyMeans {
  return {
    tiers: {
      recomputed: input.aggregate_ok && input.chain_ok && input.predecessor_ok && input.peac_ok,
      settlement_confirmed: input.settlement_confirmed,
      hcs_confirmed: input.hcs_confirmed,
      cre_simulation: Boolean(input.cre_ok && input.cre_mode === "simulation"),
      cre_don_verified: Boolean(input.cre_ok && input.cre_mode === "don"),
    },
    hcs_present: input.hcs_present,
    ok_means: "local_hashes_and_public_settlement",
    cre_ok_means: "structural_simulation_fields",
  };
}
