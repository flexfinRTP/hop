import {
  HTTPCapability,
  HTTPClient,
  decodeJson,
  handlerInTee,
  ok,
  Runner,
  text,
  type HTTPPayload,
  type TeeRuntime,
} from "@chainlink/cre-sdk";
import {
  canonicalJson,
  creCommitment,
  fetchProtocolSnapshotSync,
  hashAggregate,
  hashJson,
  joinAndAggregate,
  parsePolicyTable,
  sanitizeAggregate,
  type GraphHttp,
  type QueryRequest,
  type QueryType,
} from "../../packages/shared/src/index.ts";

type GraphCfg = {
  key?: string;
  slug: string;
  url: string;
  id: string;
};

type Config = {
  query: QueryType;
  protocols: string[];
  max_block_lag: number;
  window?: { from: string; to: string };
  chain_rpc_url: string;
  authorized_evm_address?: string;
  graph: {
    schemaVersion: string;
    protocols: GraphCfg[];
  };
};

const NITRO_US_WEST_2: [{ tee: "nitro"; regions: ["us-west-2"] }] = [
  { tee: "nitro", regions: ["us-west-2"] },
];

function creHttp(runtime: TeeRuntime<Config>): GraphHttp {
  const client = new HTTPClient();
  return {
    postJson(url, body, headers = {}) {
      const encoded = Buffer.from(JSON.stringify(body)).toString("base64");
      const multiHeaders: Record<string, { values: string[] }> = {
        "Content-Type": { values: ["application/json"] },
      };
      for (const [key, value] of Object.entries(headers)) {
        multiHeaders[key] = { values: [value] };
      }
      const response = client
        .sendRequest(runtime, {
          url,
          method: "POST",
          timeout: "20s",
          body: encoded,
          multiHeaders,
        })
        .result();
      if (!ok(response)) {
        throw new Error(`http_${response.statusCode}`);
      }
      return { status: response.statusCode, text: text(response) };
    },
  };
}

function chainHeadSync(http: GraphHttp, rpc: string): number | undefined {
  if (!rpc) return undefined;
  const res = http.postJson(rpc, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_blockNumber",
    params: [],
  });
  if (typeof (res as Promise<unknown>).then === "function") return undefined;
  const parsed = JSON.parse((res as { text: string }).text) as { result?: string };
  if (!parsed.result) return undefined;
  return Number.parseInt(parsed.result, 16);
}

function requiredSecret(runtime: TeeRuntime<Config>, id: string): string {
  const secret = runtime.getSecret({ id }).result().value?.trim() ?? "";
  if (!secret) throw new Error(`secret_${id.toLowerCase()}_unavailable`);
  return secret;
}

function authHeaders(runtime: TeeRuntime<Config>): Record<string, string> {
  const token = requiredSecret(runtime, "GRAPH_API_KEY");
  return {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  };
}

function queryFromPayload(runtime: TeeRuntime<Config>, payload: HTTPPayload): QueryRequest {
  let decoded: Partial<QueryRequest> = {};
  try {
    decoded = decodeJson(payload.input) as Partial<QueryRequest>;
  } catch {
    decoded = {};
  }
  const query = decoded.query ?? runtime.config.query;
  const protocols = decoded.protocols ?? runtime.config.protocols;
  const max_block_lag = decoded.max_block_lag ?? runtime.config.max_block_lag;
  if (!query || !Array.isArray(protocols) || protocols.length < 1 || !Number.isFinite(max_block_lag)) {
    throw new Error("bad_http_payload");
  }
  return {
    query,
    protocols,
    max_block_lag,
    window: decoded.window ?? runtime.config.window,
  };
}

function reportCommitment(runtime: TeeRuntime<Config>, commitment: Record<string, unknown>): string {
  const encoded = Buffer.from(canonicalJson(commitment)).toString("base64");
  const donRuntime = runtime.usingTheDons();
  donRuntime
    .report({
      encodedPayload: encoded,
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();
  return hashJson(commitment);
}

const onQuery = (runtime: TeeRuntime<Config>, payload: HTTPPayload): string => {
  let policyRaw = "";
  try {
    policyRaw = runtime.getSecret({ id: "POLICY_TABLE" }).result().value ?? "";
  } catch {
    policyRaw = "";
  }
  const policy = parsePolicyTable(policyRaw);
  if (!policy) {
    return JSON.stringify({ error: "policy_unavailable" });
  }

  const request = queryFromPayload(runtime, payload);
  const http = creHttp(runtime);
  const requested = new Set(request.protocols);
  const protocols = runtime.config.graph.protocols.filter(
    (protocol) =>
      protocol.url &&
      [...requested].some(
        (value) =>
          protocol.key === value ||
          protocol.slug === value ||
          protocol.slug.startsWith(`${value}-`),
      ),
  );
  if (protocols.length !== requested.size) {
    return JSON.stringify({ error: "graph_unconfigured" });
  }

  try {
    const headers = authHeaders(runtime);
    const policyCommitmentKey = requiredSecret(runtime, "POLICY_COMMITMENT_SALT");
    const head = chainHeadSync(http, runtime.config.chain_rpc_url);
    const snapshot = {
      chainHead: head,
      protocols: protocols.map((p) =>
        fetchProtocolSnapshotSync(http, {
          slug: p.slug,
          url: p.url,
          subgraphId: p.id,
          authHeaders: headers,
          request,
          policy,
          chainHead: head,
        }),
      ),
    };
    const joined = joinAndAggregate(policy, snapshot, request, policyCommitmentKey);
    const aggregate = sanitizeAggregate(joined.aggregate);
    const commitment = creCommitment({
      status: joined.status,
      policy_hash: joined.policy.threshold_hash,
      aggregate_hash: hashAggregate(aggregate),
      k_anon: joined.k_anon,
      graph: joined.graph,
    });
    const cre_commitment_hash = reportCommitment(runtime, commitment);
    return JSON.stringify({
      cre: {
        mode: "simulation",
        artifact: "handlerInTee",
        tee: "nitro:us-west-2",
        trigger: "http",
        cre_commitment_hash,
      },
      status: joined.status,
      aggregate,
      k_anon: joined.k_anon,
      graph: joined.graph,
      policy: joined.policy,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "join_error";
    return JSON.stringify({ error: "join_failed", detail: msg });
  }
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  const trigger = config.authorized_evm_address
    ? http.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.authorized_evm_address,
          },
        ],
      })
    : http.trigger({});
  return [handlerInTee(trigger, onQuery, NITRO_US_WEST_2)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

await main();
