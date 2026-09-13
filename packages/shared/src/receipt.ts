import {
  reasonCodeFromQueryStatus,
  screeningFor,
  verdictFromQueryStatus,
  type IdentityReceipt,
  type Screening,
} from "./decision.js";
import { DEMO_VERTICAL, type Evidence, type VerifiableDecisionReceipt } from "./types.js";

export function decisionReceiptFromEvidence(
  evidence: Evidence,
  charge: VerifiableDecisionReceipt["charge"],
): VerifiableDecisionReceipt {
  const status = evidence.status;
  const screening: Screening = evidence.screening ?? screeningFor(evidence.posture?.world ?? "off");
  const identity: IdentityReceipt | undefined = evidence.identity;
  return {
    schema: "hop.decision.v1",
    decision: {
      status,
      verdict: evidence.verdict ?? verdictFromQueryStatus(status),
      reason_code: evidence.reason_code ?? reasonCodeFromQueryStatus(status),
      query: evidence.query.type,
      demo_vertical: DEMO_VERTICAL,
    },
    privacy: {
      policy_values: "omitted",
      graph_source: "public",
      settlement: "public",
    },
    payment: {
      network: "hedera:testnet",
      scheme: "exact",
      rail: "hedera_x402_exact",
      ref: evidence.settlement.ref,
      payer_account: evidence.payer_account,
      amount: evidence.meter?.amount ?? "",
    },
    charge,
    screening,
    identity,
    hcs:
      evidence.hcs_seq !== undefined
        ? { topic: evidence.hcs_topic, sequence: evidence.hcs_seq }
        : undefined,
    graph: evidence.graph,
    cre: evidence.cre,
    hashes: {
      aggregate: evidence.aggregate_hash,
      policy: evidence.policy.threshold_hash,
      peac: evidence.peac_hash,
      chain: evidence.chain?.hash,
      cre_commitment: evidence.cre.cre_commitment_hash ?? evidence.cre.report_hash,
    },
    evidence_id: evidence.id,
    verify_path: `/verify/${evidence.id}`,
  };
}
