import { hashJson } from "./hash.js";
import { POSTURE, type Evidence, type HopPosture } from "./types.js";

export type PeacReceipt = {
  spec: "peac-shaped/hop-0.1";
  interaction: {
    id: string;
    timestamp: string;
    resource: "/v1/query";
    status: Evidence["status"];
  };
  payment: {
    network: "hedera:testnet";
    settlement: string;
    payer?: string;
    amount?: string;
  };
  mandate?: { id: string; hash: string };
  source: Evidence["graph"];
  result: {
    aggregate_hash: string;
    policy_hash: string;
    k_anon: Evidence["k_anon"];
    cre: Evidence["cre"];
  };
  chain?: Evidence["chain"];
  hcs_seq?: number;
  world?: Evidence["world"];
  posture: HopPosture;
};

export function peacFromEvidence(evidence: Evidence): PeacReceipt {
  return {
    spec: "peac-shaped/hop-0.1",
    interaction: {
      id: evidence.id,
      timestamp: evidence.timestamp,
      resource: "/v1/query",
      status: evidence.status,
    },
    payment: {
      network: "hedera:testnet",
      settlement: evidence.settlement.ref,
      payer: evidence.payer_account,
      amount: evidence.meter?.amount,
    },
    mandate: evidence.mandate
      ? { id: evidence.mandate.id, hash: evidence.mandate.hash }
      : undefined,
    source: evidence.graph,
    result: {
      aggregate_hash: evidence.aggregate_hash,
      policy_hash: evidence.policy.threshold_hash,
      k_anon: evidence.k_anon,
      cre: evidence.cre,
    },
    chain: evidence.chain,
    hcs_seq: evidence.hcs_seq,
    world: evidence.world,
    posture: evidence.posture ?? { ...POSTURE, cre: evidence.cre.mode },
  };
}

export function peacHash(receipt: PeacReceipt): string {
  return hashJson(receipt);
}

export const GENESIS_CHAIN = "0".repeat(64);

export function chainHash(input: {
  id: string;
  aggregate_hash: string;
  settlement: string;
  prev: string;
  mandate_hash?: string;
}): string {
  return hashJson(input);
}
