import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLOCKY402_TESTNET,
  DEFAULT_MANDATE_JSON,
  PINNED_DEPLOYMENTS,
  priceTinybars,
  type PaymentRequirements,
  type QueryRequest,
} from "@hop/shared";

const here = fileURLToPath(new URL(".", import.meta.url));

export type AppConfig = {
  port: number;
  facilitatorUrl: string;
  network: "hedera:testnet";
  asset: string;
  payTo: string;
  amount: string;
  maxTimeoutSeconds: number;
  policyJson: string;
  graphApiKey: string;
  chainRpcUrl: string;
  protocols: { key: string; slug: string; id: string; url: string }[];
  payerAllowlist: string[];
  rateLimitPerMin: number;
  hopJoin: "inline" | "cre";
  creCwd: string;
  creCli: string;
  creEthPrivateKey: string;
  creWorkflowId: string;
  creGatewayUrl: string;
  demoSign: boolean;
  demoAccountId: string;
  demoPrivateKey: string;
  hcsTopic: string;
  hcsAuto: boolean;
  hederaOperatorId: string;
  hederaOperatorKey: string;
  corsOrigin: string;
  wallBuffer: number;
  evidenceDir: string;
  evidenceTtlMs: number;
  mandateJson: string;
  mandateRequired: boolean;
  meterPerProtocol: string;
  meterUtilScale: string;
  worldAppId: string;
  worldRpId: string;
  worldRpSigningKey: string;
  worldAction: string;
  worldEnvironment: "staging" | "production";
  worldRequired: boolean;
};

function req(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function loadConfig(): AppConfig {
  const key = req("GRAPH_API_KEY");
  const gateway = req("GRAPH_GATEWAY") || "https://gateway.thegraph.com/api/subgraphs/id";
  const protocols = (["aave-v3", "compound-v3"] as const).map((name) => {
    const pinned = PINNED_DEPLOYMENTS[name];
    const id = req(`GRAPH_PROTOCOL_${name === "aave-v3" ? "A" : "B"}_ID`) || pinned.id;
    const explicit = req(`GRAPH_PROTOCOL_${name === "aave-v3" ? "A" : "B"}_URL`);
    let url = explicit;
    if (!url && key) {
      url =
        req("GRAPH_API_KEY_IN_PATH") === "1"
          ? `https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`
          : `${gateway.replace(/\/$/, "")}/${id}`;
    }
    return { key: name, slug: pinned.slug, id, url };
  });

  return {
    port: Number(process.env.PORT ?? 8787),
    facilitatorUrl: req("BLOCKY402_FACILITATOR_URL") || BLOCKY402_TESTNET,
    network: "hedera:testnet",
    asset: req("HEDERA_ASSET") || "0.0.0",
    payTo: req("HEDERA_PAY_TO"),
    amount: req("HOP_PRICE_TINYBARS") || "100000",
    maxTimeoutSeconds: 300,
    policyJson: req("HOP_POLICY_TABLE_JSON"),
    graphApiKey: key,
    chainRpcUrl: req("CHAIN_RPC_URL") || "https://ethereum-rpc.publicnode.com",
    protocols,
    payerAllowlist: req("PAYER_ALLOWLIST")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitPerMin: Number(process.env.QUERY_RATE_LIMIT_PER_MIN ?? 6),
    hopJoin: req("HOP_JOIN") === "inline" ? "inline" : "cre",
    creCwd: req("CRE_CWD") || path.resolve(here, "../../../cre"),
    creCli: req("CRE_CLI") || "cre",
    creEthPrivateKey: req("CRE_ETH_PRIVATE_KEY"),
    creWorkflowId: req("CRE_WORKFLOW_ID"),
    creGatewayUrl: req("CRE_GATEWAY_URL"),
    demoSign: req("HOP_DEMO_SIGN") === "1",
    demoAccountId: req("HEDERA_DEMO_ACCOUNT_ID"),
    demoPrivateKey: req("HEDERA_DEMO_PRIVATE_KEY"),
    hcsTopic: req("HEDERA_HCS_TOPIC"),
    hcsAuto: req("HOP_HCS_AUTO") !== "0",
    hederaOperatorId: req("HEDERA_OPERATOR_ID"),
    hederaOperatorKey: req("HEDERA_OPERATOR_KEY"),
    corsOrigin: req("HOP_CORS_ORIGIN") || "http://localhost:5173",
    wallBuffer: Number(process.env.WALL_BUFFER ?? 0.2),
    evidenceDir: req("HOP_EVIDENCE_DIR") || path.resolve(here, "../../../data/evidence"),
    evidenceTtlMs: Number(process.env.HOP_EVIDENCE_TTL_MS ?? 72 * 3600 * 1000),
    mandateJson: req("HOP_MANDATE_JSON") || DEFAULT_MANDATE_JSON,
    mandateRequired: req("HOP_MANDATE_REQUIRED") === "1",
    meterPerProtocol: req("HOP_METER_TINYBARS") || "10000",
    meterUtilScale: req("HOP_METER_UTIL_TINYBARS") || "0",
    worldAppId: req("WORLD_APP_ID"),
    worldRpId: req("WORLD_RP_ID"),
    worldRpSigningKey: req("WORLD_RP_SIGNING_KEY"),
    worldAction: req("WORLD_ACTION") || "hop-query",
    worldEnvironment: req("WORLD_ENVIRONMENT") === "production" ? "production" : "staging",
    worldRequired: req("WORLD_REQUIRED") === "1",
  };
}

export function requirements(cfg: AppConfig, feePayer: string, amount = cfg.amount): PaymentRequirements {
  return {
    scheme: "exact",
    network: "hedera:testnet",
    amount,
    payTo: cfg.payTo,
    maxTimeoutSeconds: cfg.maxTimeoutSeconds,
    asset: cfg.asset,
    extra: { feePayer },
  };
}

export function quoteAmount(cfg: AppConfig, protocolCount: number, publicUtil?: number): string {
  return priceTinybars(cfg.amount, protocolCount, cfg.meterPerProtocol, publicUtil, cfg.meterUtilScale);
}

export function queryParams(body: QueryRequest): Record<string, unknown> {
  return {
    query: body.query,
    protocols: body.protocols,
    max_block_lag: body.max_block_lag,
    ...(body.window ? { window: body.window } : {}),
  };
}
