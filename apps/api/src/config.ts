import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATS_TESTNET,
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
  databaseUrl: string;
  databaseSsl: boolean;
  mirrorNodeUrl: string;
  publicBaseUrl: string;
  adminToken: string;
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
  policyCommitmentSalt: string;
  agent0SubgraphId: string;
  agent0SubgraphUrl: string;
  agent0ChainId: string;
  agent0AgentId: string;
  agent0Registry: string;
  mcpPublicUrl: string;
  registrationImageUrl: string;
  atsFactoryAddress: string;
  atsResolverAddress: string;
  atsRpcUrl: string;
  atsMirrorNodeUrl: string;
  atsExplorerUrl: string;
  atsSdkVersion: string;
  atsBondConfigId: string;
  atsBondConfigVersion: number;
  liquidationRpcUrl: string;
  liquidationParticipant: string;
  liquidationWorkflowId: string;
  passportSecret: string;
  passportRequired: boolean;
  passportTtlMs: number;
  hopDid: string;
};

function req(name: string): string {
  return (process.env[name] ?? "").trim();
}

function resolveCreCli(): string {
  const explicit = req("CRE_CLI");
  if (explicit) return explicit;
  const localApp = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    path.join(localApp, "Programs", "cre", "cre.exe"),
    path.join(localApp, "cre", "cre.exe"),
    "cre",
  ];
  for (const candidate of candidates) {
    if (candidate === "cre") return candidate;
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* continue */
    }
  }
  return "cre";
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
    hopJoin:
      req("HOP_JOIN") === "inline" || (Boolean(process.env.VERCEL) && req("HOP_JOIN") !== "cre")
        ? "inline"
        : "cre",
    creCwd: req("CRE_CWD") || path.resolve(here, "../../../cre"),
    creCli: resolveCreCli(),
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
    evidenceDir:
      req("HOP_EVIDENCE_DIR") ||
      (process.env.VERCEL ? "/tmp/hop-evidence" : path.resolve(here, "../../../data/evidence")),
    evidenceTtlMs: Number(process.env.HOP_EVIDENCE_TTL_MS ?? 72 * 3600 * 1000),
    databaseUrl: req("DATABASE_URL"),
    databaseSsl: req("DATABASE_SSL") === "1",
    mirrorNodeUrl: req("HEDERA_MIRROR_NODE_URL") || "https://testnet.mirrornode.hedera.com",
    publicBaseUrl: req("HOP_PUBLIC_BASE_URL"),
    adminToken: req("HOP_ADMIN_TOKEN"),
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
    policyCommitmentSalt: req("HOP_POLICY_COMMITMENT_SALT"),
    agent0SubgraphId: req("AGENT0_SUBGRAPH_ID"),
    agent0SubgraphUrl: req("AGENT0_SUBGRAPH_URL"),
    agent0ChainId: req("AGENT0_CHAIN_ID"),
    agent0AgentId: req("AGENT0_AGENT_ID"),
    agent0Registry: req("AGENT0_REGISTRY_CAIP"),
    mcpPublicUrl: req("HOP_MCP_PUBLIC_URL"),
    registrationImageUrl: req("HOP_REGISTRATION_IMAGE_URL"),
    atsFactoryAddress: req("ATS_FACTORY_ADDRESS") || ATS_TESTNET.factory,
    atsResolverAddress: req("ATS_RESOLVER_ADDRESS") || ATS_TESTNET.resolver,
    atsRpcUrl: req("ATS_RPC_URL") || "https://testnet.hashio.io/api",
    atsMirrorNodeUrl: req("ATS_MIRROR_NODE_URL") || "https://testnet.mirrornode.hedera.com",
    atsExplorerUrl: req("ATS_EXPLORER_URL") || "https://hashscan.io/testnet",
    atsSdkVersion: req("ATS_SDK_VERSION") || ATS_TESTNET.sdkVersion,
    atsBondConfigId: req("ATS_BOND_CONFIG_ID") || ATS_TESTNET.bondConfigId,
    atsBondConfigVersion: Number(req("ATS_BOND_CONFIG_VERSION") || 1),
    liquidationRpcUrl:
      req("LIQUIDATION_PUBLIC_RPC_URL") ||
      "https://ethereum-sepolia-rpc.publicnode.com",
    liquidationParticipant: req("LIQUIDATION_PARTICIPANT_ADDRESS"),
    liquidationWorkflowId: req("LIQUIDATION_WORKFLOW_ID"),
    passportSecret: req("HOP_PASSPORT_SECRET"),
    passportRequired: req("HOP_PASSPORT_REQUIRED") === "1",
    passportTtlMs: Number(process.env.HOP_PASSPORT_TTL_MS ?? 30 * 24 * 3600 * 1000),
    hopDid: req("HOP_DID"),
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
