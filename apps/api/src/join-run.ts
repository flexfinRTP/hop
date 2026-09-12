import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  hashAggregate,
  joinAndAggregate,
  parsePolicyTable,
  sanitizeAggregate,
  type HopJoinResult,
  type QueryRequest,
} from "@hop/shared";
import type { AppConfig } from "./config.js";
import { liveSnapshot } from "./graph.js";

export type JoinOutcome = HopJoinResult & {
  cre: { mode: "simulation" | "don"; artifact?: string };
};

export async function runJoin(
  cfg: AppConfig,
  request: QueryRequest,
  onTrace: (rail: "graph" | "cre", msg: string) => void,
): Promise<JoinOutcome> {
  const policy = parsePolicyTable(cfg.policyJson);
  if (!policy) {
    throw Object.assign(new Error("policy_unavailable"), { code: "policy_unavailable" });
  }

  if (cfg.hopJoin === "cre") {
    onTrace("cre", "cre workflow simulate hop-query --target staging-settings");
    try {
      const cre = await simulateCre(cfg, request);
      onTrace("cre", "CRE: simulation");
      return cre;
    } catch (err) {
      onTrace("cre", `CRE CLI failed; inline engine ${err instanceof Error ? err.message : ""}`.trim());
    }
  }

  onTrace("graph", "live GraphQL two protocols Messari 3.1.0");
  const snapshot = await liveSnapshot(cfg, request);
  for (const p of snapshot.protocols) {
    onTrace(
      "graph",
      `${p.slug} schemaVersion ${p.schemaVersion} block ${p.block ?? "?"} id ${p.deploymentId}`,
    );
  }
  onTrace("cre", "handlerInTee join (inline engine; same as cre/hop-query)");
  const joined = joinAndAggregate(policy, snapshot, request);
  return {
    ...joined,
    aggregate: sanitizeAggregate(joined.aggregate),
    cre: {
      mode: "simulation",
      artifact: cfg.hopJoin === "cre" ? "inline-fallback" : "handlerInTee-inline",
    },
  };
}

async function simulateCre(cfg: AppConfig, request: QueryRequest): Promise<JoinOutcome> {
  const configPath = path.join(cfg.creCwd, "hop-query", "config.staging.json");
  const graph = {
    schemaVersion: "3.1.0",
    graph_auth_header: cfg.graphApiKey ? `Bearer ${cfg.graphApiKey}` : "",
    protocols: cfg.protocols.map((p) => ({ slug: p.slug, id: p.id, url: p.url })),
  };
  await writeFile(
    configPath,
    JSON.stringify(
      {
        schedule: "*/30 * * * * *",
        query: request.query,
        protocols: request.protocols,
        max_block_lag: request.max_block_lag,
        window: request.window,
        chain_rpc_url: cfg.chainRpcUrl,
        graph,
      },
      null,
      2,
    ),
  );

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn("cre", ["workflow", "simulate", "hop-query", "--target", "staging-settings"], {
      cwd: cfg.creCwd,
      shell: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("cre_timeout"));
    }, 120_000);
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(err || `cre_exit_${code}`));
      else resolve(out);
    });
  });

  const json = extractJson(stdout);
  if (json && json.error === "policy_unavailable") {
    throw Object.assign(new Error("policy_unavailable"), { code: "policy_unavailable" });
  }
  if (!json || !json.status) {
    throw new Error("cre_no_result");
  }
  return {
    status: json.status,
    aggregate: sanitizeAggregate(json.aggregate),
    k_anon: json.k_anon ?? { result: "not_applicable" },
    graph: json.graph ?? { deployments: [] },
    policy: json.policy ?? { version: "unknown", threshold_hash: hashAggregate({}) },
    cre: json.cre ?? { mode: "simulation", artifact: stdout.slice(-2000) },
  };
}

function extractJson(text: string): JoinOutcome & { error?: string } | null {
  const matches = text.match(/\{[\s\S]*\}/g);
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]!) as JoinOutcome & { error?: string };
    } catch {
      continue;
    }
  }
  return null;
}
