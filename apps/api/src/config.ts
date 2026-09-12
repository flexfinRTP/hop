import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLOCKY402_TESTNET,
  PINNED_DEPLOYMENTS,
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
  demoSign: boolean;
  demoAccountId: string;
  demoPrivateKey: string;
  hcsTopic: string;
  hederaOperatorId: string;
  hederaOperatorKey: string;
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
    const url =
      explicit ||
      (key ? `${gateway.replace(/\/$/, "")}/${id}` : "") ||
      (req("GRAPH_API_KEY_IN_PATH")
        ? `https://gateway.thegraph.com/api/${key}/subgraphs/id/${id}`
        : `https://gateway.thegraph.com/api/subgraphs/id/${id}`);
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
    hopJoin: req("HOP_JOIN") === "cre" ? "cre" : "inline",
    creCwd: req("CRE_CWD") || path.resolve(here, "../../../cre"),
    demoSign: req("HOP_DEMO_SIGN") === "1",
    demoAccountId: req("HEDERA_DEMO_ACCOUNT_ID"),
    demoPrivateKey: req("HEDERA_DEMO_PRIVATE_KEY"),
    hcsTopic: req("HEDERA_HCS_TOPIC"),
    hederaOperatorId: req("HEDERA_OPERATOR_ID"),
    hederaOperatorKey: req("HEDERA_OPERATOR_KEY"),
  };
}

export function requirements(cfg: AppConfig, feePayer: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: "hedera:testnet",
    amount: cfg.amount,
    payTo: cfg.payTo,
    maxTimeoutSeconds: cfg.maxTimeoutSeconds,
    asset: cfg.asset,
    extra: { feePayer },
  };
}

export function queryParams(body: QueryRequest): Record<string, unknown> {
  return {
    query: body.query,
    protocols: body.protocols,
    max_block_lag: body.max_block_lag,
    ...(body.window ? { window: body.window } : {}),
  };
}
