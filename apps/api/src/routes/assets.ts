import { Hono } from "hono";
import {
  ATS_OPTIONAL_STAGES,
  ATS_REQUIRED_STAGES,
  ATS_STAGES,
  ATS_TESTNET,
  atsRequiredStages,
  hashJson,
  type AssetIntent,
  type AssetTerms,
  type AtsStage,
} from "@hop/shared";
import {
  getAssetIntent,
  listAssetIntents,
  putAssetIntent,
} from "../asset-store.js";
import {
  verifyAtsAssetContract,
  verifyAtsTransaction,
} from "../ats-verifier.js";
import { loadConfig } from "../config.js";
import { verifyEvidenceExternally } from "../hedera-mirror.js";
import { submitHcsJson } from "../hcs.js";
import { getById, isId, newId, put } from "../store.js";

function termsFrom(value: unknown): AssetTerms | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const terms: AssetTerms = {
    name: String(row.name ?? "").trim(),
    symbol: String(row.symbol ?? "").trim().toUpperCase(),
    instrument_id: String(row.instrument_id ?? "").trim(),
    currency: String(row.currency ?? "").trim().toUpperCase(),
    decimals: Number(row.decimals),
    max_supply: String(row.max_supply ?? "").trim(),
    nominal_value: String(row.nominal_value ?? "").trim(),
    nominal_value_decimals: Number(row.nominal_value_decimals),
    starting_date: String(row.starting_date ?? "").trim(),
    maturity_date: String(row.maturity_date ?? "").trim(),
    coupon_rate_bps: Number(row.coupon_rate_bps),
  };
  let supply = 0n;
  try {
    supply = BigInt(terms.max_supply);
  } catch {
    return null;
  }
  if (
    terms.name.length < 3 ||
    terms.name.length > 80 ||
    !/^[A-Z0-9]{1,12}$/.test(terms.symbol) ||
    !/^[A-Z0-9]{12}$/.test(terms.instrument_id) ||
    !/^[A-Z]{3,6}$/.test(terms.currency) ||
    !Number.isInteger(terms.decimals) ||
    terms.decimals < 0 ||
    terms.decimals > 18 ||
    supply <= 0n ||
    !/^\d+$/.test(terms.nominal_value) ||
    BigInt(terms.nominal_value) <= 0n ||
    !Number.isInteger(terms.nominal_value_decimals) ||
    terms.nominal_value_decimals < 0 ||
    terms.nominal_value_decimals > 18 ||
    !Number.isFinite(Date.parse(terms.starting_date)) ||
    Date.parse(terms.starting_date) <= Date.now() ||
    !Number.isFinite(Date.parse(terms.maturity_date)) ||
    Date.parse(terms.maturity_date) <= Date.parse(terms.starting_date) ||
    !Number.isInteger(terms.coupon_rate_bps) ||
    terms.coupon_rate_bps < 0 ||
    terms.coupon_rate_bps > 10_000 ||
    terms.coupon_rate_bps % 100 !== 0
  ) {
    return null;
  }
  return terms;
}

function actionFrom(value: unknown): AssetIntent["action"] | null {
  const values: AssetIntent["action"][] = [
    "issue_and_lock",
    "coupon",
    "redeem",
    "pause",
    "unpause",
  ];
  return values.includes(value as AssetIntent["action"])
    ? (value as AssetIntent["action"])
    : null;
}

function isStage(value: string): value is AtsStage {
  return (
    (ATS_REQUIRED_STAGES as readonly string[]).includes(value) ||
    (ATS_OPTIONAL_STAGES as readonly string[]).includes(value)
  );
}

function atsConfigured(cfg: ReturnType<typeof loadConfig>): boolean {
  return Boolean(
    cfg.atsFactoryAddress &&
      cfg.atsResolverAddress &&
      cfg.atsRpcUrl &&
      cfg.atsSdkVersion &&
      /^0x[a-fA-F0-9]{64}$/.test(cfg.atsBondConfigId) &&
      Number.isInteger(cfg.atsBondConfigVersion) &&
      cfg.atsBondConfigVersion > 0,
  );
}

export const assets = new Hono();

assets.get("/config", (c) => {
  const cfg = loadConfig();
  return c.json({
    configured: atsConfigured(cfg),
    network: "hedera:testnet",
    chain_id: 296,
    factory_address: cfg.atsFactoryAddress || ATS_TESTNET.factory,
    resolver_address: cfg.atsResolverAddress || ATS_TESTNET.resolver,
    rpc_url: cfg.atsRpcUrl,
    mirror_node_url: cfg.atsMirrorNodeUrl,
    explorer_url: cfg.atsExplorerUrl,
    sdk_version: cfg.atsSdkVersion || ATS_TESTNET.sdkVersion,
    bond_config_id: cfg.atsBondConfigId || ATS_TESTNET.bondConfigId,
    bond_config_version: cfg.atsBondConfigVersion,
    wallet_required: true,
    custody: "browser_wallet",
    stages: ATS_STAGES,
    optional_stages: ATS_OPTIONAL_STAGES,
  });
});

assets.get("/", (c) => {
  const requested = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(requested) ? requested : 50;
  const items = listAssetIntents(limit);
  return c.json({ items, count: items.length });
});

assets.post("/intents", async (c) => {
  const cfg = loadConfig();
  if (!atsConfigured(cfg)) return c.json({ error: "ats_unconfigured" }, 503);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: "bad_body" }, 400);
  const evidenceId = String(body.evidence_id ?? "");
  const evidence = isId(evidenceId) ? getById(evidenceId) : undefined;
  if (!evidence) return c.json({ error: "evidence_not_found" }, 404);
  if (evidence.json.status !== "accept") {
    return c.json({ error: "evidence_not_accepted" }, 409);
  }
  const external = await verifyEvidenceExternally(cfg, evidence.json);
  evidence.json.verification = external;
  await put(evidence);
  if (!external.settlement.verified) {
    return c.json({ error: "settlement_unverified", verification: external }, 409);
  }
  const terms = termsFrom(body.terms);
  const action = actionFrom(body.action);
  if (!terms || !action) return c.json({ error: "bad_asset_intent" }, 400);
  const parentId = String(body.parent_intent_id ?? "").trim();
  const parent = parentId ? getAssetIntent(parentId) : undefined;
  if (action !== "issue_and_lock") {
    if (!parent || parent.status !== "verified" || !parent.asset_contract) {
      return c.json({ error: "parent_asset_required" }, 409);
    }
  }
  const now = new Date().toISOString();
  const intent: AssetIntent = {
    id: newId(),
    evidence_id: evidenceId,
    created_at: now,
    updated_at: now,
    network: "hedera:testnet",
    kind: "private_credit_bond",
    action,
    status: "draft",
    terms,
    controls: {
      kyc: body.kyc === true,
      controllist: body.controllist === "blocklist" ? "blocklist" : "allowlist",
      clearing: body.clearing === true,
    },
    parent_intent_id: parent?.id,
    asset_contract: parent?.asset_contract,
    wallet_account: parent?.wallet_account,
    transactions: [],
  };
  await putAssetIntent(intent);
  evidence.json.posture = { ...evidence.json.posture!, ats: "intent" };
  await put(evidence);
  return c.json({ intent }, 201);
});

assets.post("/intents/:id/transactions", async (c) => {
  const cfg = loadConfig();
  if (!atsConfigured(cfg)) return c.json({ error: "ats_unconfigured" }, 503);
  const intent = getAssetIntent(c.req.param("id"));
  if (!intent) return c.json({ error: "not_found" }, 404);
  if (intent.status === "verified") return c.json({ intent });
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const assetContract = String(body?.asset_contract ?? "").trim();
  const walletAccount = String(body?.wallet_account ?? "").trim();
  const submitted = Array.isArray(body?.transactions)
    ? body.transactions as Record<string, unknown>[]
    : [];
  const required = atsRequiredStages(intent.action);
  if (
    !/^(0\.0\.\d+|0x[a-fA-F0-9]{40})$/.test(assetContract) ||
    !/^(0\.0\.\d+|0x[a-fA-F0-9]{40})$/.test(walletAccount) ||
    submitted.length < required.length ||
    submitted.length > 16
  ) {
    return c.json({ error: "bad_transactions" }, 400);
  }
  const transactionsToVerify: { stage: AtsStage; transactionId: string }[] = [];
  const transactionIds = new Set<string>();
  for (const row of submitted) {
    const stage = String(row.stage);
    const transactionId = String(row.transaction_id ?? "").trim();
    if (!isStage(stage) || !transactionId || transactionIds.has(transactionId)) {
      return c.json({ error: "bad_transactions" }, 400);
    }
    transactionIds.add(transactionId);
    transactionsToVerify.push({ stage, transactionId });
  }
  if (required.some((stage) => !transactionsToVerify.some((row) => row.stage === stage))) {
    return c.json({ error: "incomplete_lifecycle" }, 400);
  }

  const [asset, transactions] = await Promise.all([
    verifyAtsAssetContract(cfg, assetContract),
    Promise.all(
      transactionsToVerify.map(({ stage, transactionId }) =>
        verifyAtsTransaction(cfg, stage, transactionId),
      ),
    ),
  ]);
  const verified = asset.verified && transactions.every((transaction) => transaction.verified);
  intent.asset_contract = asset.contractId ?? asset.evmAddress ?? assetContract;
  intent.wallet_account = walletAccount;
  intent.transactions = transactions;
  intent.status = verified ? "verified" : "failed";
  intent.updated_at = new Date().toISOString();

  if (verified) {
    const anchor = await submitHcsJson(cfg, {
      type: "hop.ats-lifecycle.v1",
      intent_id: intent.id,
      evidence_id: intent.evidence_id,
      asset_contract: intent.asset_contract,
      lifecycle_hash: hashJson(
        transactions.map(({ stage, transaction_id, contract_id }) => ({
          stage,
          transaction_id,
          contract_id,
        })),
      ),
    }).catch(() => undefined);
    if (anchor) {
      intent.hcs_topic = anchor.topic;
      intent.hcs_seq = anchor.sequence;
    }
  }
  await putAssetIntent(intent);

  const evidence = getById(intent.evidence_id);
  if (evidence && intent.asset_contract) {
    evidence.json.asset = {
      intent_id: intent.id,
      contract_id: intent.asset_contract,
      lifecycle_verified: verified,
    };
    evidence.json.posture = {
      ...evidence.json.posture!,
      ats: verified ? "verified" : "intent",
    };
    await put(evidence);
  }
  return c.json({ intent }, verified ? 200 : 422);
});

assets.get("/intents/:id", (c) => {
  const intent = getAssetIntent(c.req.param("id"));
  return intent ? c.json({ intent }) : c.json({ error: "not_found" }, 404);
});
