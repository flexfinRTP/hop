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
  creCommitment,
  fetchProtocolSnapshotSync,
  hashAggregate,
  joinAndAggregate,
  parsePolicyTable,
  sanitizeAggregate,
  type GraphHttp,
  type QueryRequest,
  type QueryType,
} from "../../packages/shared/src/index.ts";

type GraphCfg = {
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
    graph_auth_header?: string;
    protocols: GraphCfg[];
  };
};

const NITRO_US_WEST_2 = [{ tee: "nitro" as const, regions: ["us-west-2"] }];

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

function authHeaders(config: Config, runtime: TeeRuntime<Config>): Record<string, string> {
  const headers: Record<string, string> = {};
  let token = config.graph.graph_auth_header?.trim() ?? "";
  if (!token) {
    try {
      const graph = runtime.getSecret({ id: "GRAPH_API_KEY" }).result();
      token = graph.value?.trim() ?? "";
    } catch {
      token = "";
    }
  }
  if (token) {
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }
  return headers;
}

function queryFromPayload(runtime: TeeRuntime<Config>, payload: HTTPPayload): QueryRequest {
  let decoded: Partial<QueryRequest> = {};
  try {
    decoded = decodeJson<Partial<QueryRequest>>(payload.input);
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
  const encoded = Buffer.from(JSON.stringify(commitment)).toString("base64");
  const donRuntime = runtime.usingTheDons();
  donRuntime
    .report({
      encodedPayload: encoded,
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();
  return encoded;
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
  const headers = authHeaders(runtime.config, runtime);
  const protocols = runtime.config.graph.protocols.filter((p) => p.url);
  if (protocols.length < 1) {
    return JSON.stringify({ error: "graph_unconfigured" });
  }

  try {
    const head = chainHeadSync(http, runtime.config.chain_rpc_url);
    const snapshot = {
      chainHead: head,
      protocols: protocols.map((p) =>
        fetchProtocolSnapshotSync(http, {
          slug: p.slug,
          url: p.url,
          deploymentId: p.id,
          authHeaders: headers,
          request,
          policy,
          chainHead: head,
        }),
      ),
    };
    const joined = joinAndAggregate(policy, snapshot, request);
    const aggregate = sanitizeAggregate(joined.aggregate);
    const commitment = creCommitment({
      status: joined.status,
      policy_hash: joined.policy.threshold_hash,
      aggregate_hash: hashAggregate(aggregate),
      k_anon: joined.k_anon,
      graph: joined.graph,
    });
    const report_hash = reportCommitment(runtime, commitment);
    return JSON.stringify({
      cre: {
        mode: "simulation",
        artifact: "handlerInTee",
        tee: "nitro:us-west-2",
        trigger: "http",
        report_hash,
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
