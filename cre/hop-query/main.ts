import {
  CronCapability,
  HTTPClient,
  handlerInTee,
  Runner,
  type TeeRuntime,
} from "@chainlink/cre-sdk";

type GraphCfg = {
  protocol_a_url: string;
  protocol_b_url: string;
  schemaVersion: string;
};

type Config = {
  schedule: string;
  query: string;
  protocols: string[];
  max_block_lag: number;
  graph: GraphCfg;
};

type PolicyTable = {
  version: string;
  caps: unknown[];
};

function loadPolicyTable(runtime: TeeRuntime<Config>): PolicyTable | null {
  const secret = runtime.getSecret({ id: "POLICY_TABLE" }).result();
  const raw = secret.value?.trim() ?? "";
  if (!raw || raw === "{}") return null;
  const table = JSON.parse(raw) as PolicyTable;
  if (!table.version || !Array.isArray(table.caps) || table.caps.length === 0) {
    return null;
  }
  return table;
}

function fetchLiveGraph(_runtime: TeeRuntime<Config>, _http: HTTPClient): never {
  // Live Studio / Graph Market URL only. No fixture file. Two Messari 3.1.0 protocols.
  throw new Error("not_implemented: fetchLiveGraph");
}

function joinAndAggregate(_policy: PolicyTable, _snapshot: unknown): never {
  // Aggregates + hashes only. Never Account.id / wallet rows. Never return cap values.
  throw new Error("not_implemented: joinAndAggregate");
}

const onQuery = (runtime: TeeRuntime<Config>): string => {
  const policy = loadPolicyTable(runtime);
  if (!policy) {
    return JSON.stringify({ error: "policy_unavailable" });
  }

  // Join is the next increment. Do not log the table (leaves the sim boundary).
  const http = new HTTPClient();
  try {
    const snapshot = fetchLiveGraph(runtime, http);
    const out = joinAndAggregate(policy, snapshot);
    return JSON.stringify(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return JSON.stringify({ error: "not_implemented", detail: msg });
  }
};

const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handlerInTee(cron.trigger({ schedule: config.schedule }), onQuery, {})];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
