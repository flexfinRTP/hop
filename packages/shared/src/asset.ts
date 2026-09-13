/** Official ATS v8 testnet deployment (2026-06-12). Override only if a newer published JSON exists. */
export const ATS_TESTNET = {
  factory: "0.0.9213391",
  resolver: "0.0.9212226",
  factoryEvm: "0xd1F118A40f3b02883D35909eF2517e7EDd78379d",
  resolverEvm: "0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a",
  bondConfigId: "0x0000000000000000000000000000000000000000000000000000000000000002",
  sdkVersion: "8.0.0",
} as const;

export const ATS_REQUIRED_STAGES = [
  "factory",
  "roles",
  "compliance",
  "issue",
  "lifecycle",
] as const;

export const ATS_OPTIONAL_STAGES = [
  "kyc",
  "coupon",
  "redeem",
  "pause",
  "unpause",
  "freeze",
] as const;

export const ATS_STAGES = ATS_REQUIRED_STAGES;

export type AtsStage =
  | (typeof ATS_REQUIRED_STAGES)[number]
  | (typeof ATS_OPTIONAL_STAGES)[number];

export type AssetTerms = {
  name: string;
  symbol: string;
  instrument_id: string;
  currency: string;
  decimals: number;
  max_supply: string;
  nominal_value: string;
  nominal_value_decimals: number;
  starting_date: string;
  maturity_date: string;
  coupon_rate_bps: number;
};

export type AssetTransaction = {
  stage: AtsStage;
  transaction_id: string;
  contract_id?: string;
  consensus_timestamp?: string;
  result?: string;
  verified: boolean;
  error?: string;
};

export type AssetIntent = {
  id: string;
  evidence_id: string;
  created_at: string;
  updated_at: string;
  network: "hedera:testnet";
  kind: "private_credit_bond";
  action: "issue_and_lock" | "coupon" | "redeem" | "pause" | "unpause";
  status: "draft" | "submitted" | "verified" | "failed";
  terms: AssetTerms;
  controls: {
    kyc: boolean;
    controllist: "allowlist" | "blocklist";
    clearing: boolean;
  };
  parent_intent_id?: string;
  asset_contract?: string;
  wallet_account?: string;
  transactions: AssetTransaction[];
  hcs_topic?: string;
  hcs_seq?: number;
};

export function atsRequiredStages(action: AssetIntent["action"]): readonly AtsStage[] {
  if (action === "issue_and_lock") return ATS_REQUIRED_STAGES;
  return [action];
}
