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
import { creEvmAddress, triggerDeployedWorkflow } from "./cre-gateway.js";
import { liveSnapshot } from "./graph.js";

export type JoinOutcome = HopJoinResult & {
  cre: {
    mode: "simulation" | "don";
    artifact?: string;
    tee?: string;
    trigger?: "http";
    report_hash?: string;
    execution_id?: string;
  };
};

function creConfig(cfg: AppConfig, request: QueryRequest) {
  return {
    query: request.query,
    protocols: request.protocols,
    max_block_lag: request.max_block_lag,
    window: request.window,
    chain_rpc_url: cfg.chainRpcUrl,
    authorized_evm_address: cfg.creWorkflowId ? creEvmAddress(cfg.creEthPrivateKey) : undefined,
    graph: {
      schemaVersion: "3.1.0",
      protocols: cfg.protocols.map((p) => ({ slug: p.slug, id: p.id, url: p.url })),
    },
  };
}

export async function checkCreCli(
  cfg: AppConfig,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (cfg.hopJoin !== "cre") return { ok: true };
  return new Promise((resolve) => {
    let settled = false;
    let output = "";
    const finish = (result: { ok: true } | { ok: false; detail: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(cfg.creCli, ["version"], {
      cwd: cfg.creCwd,
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, detail: "cre_cli_timeout" });
    }, 10_000);
    child.stdout?.on("data", (data) => {
      output += String(data);
    });
    child.stderr?.on("data", (data) => {
      output += String(data);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({ ok: false, detail: error.message || "cre_cli_unavailable" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        finish({ ok: true });
      } else {
        finish({ ok: false, detail: output.trim().slice(-240) || `cre_cli_exit_${code}` });
      }
    });
  });
}

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
    onTrace("cre", "handlerInTee HTTP Nitro us-west-2");
    const cre = await simulateCre(cfg, request, onTrace);
    if (cfg.creWorkflowId && cfg.creEthPrivateKey) {
      try {
        const don = await triggerDeployedWorkflow(cfg, {
          query: request.query,
          protocols: request.protocols,
          max_block_lag: request.max_block_lag,
          window: request.window,
        });
        onTrace("cre", `DON ${don.status ?? "ACCEPTED"} ${don.execution_id ?? ""}`.trim());
        return {
          ...cre,
          cre: {
            ...cre.cre,
            mode: "don",
            execution_id: don.execution_id,
            artifact: don.execution_id ?? cre.cre.artifact,
          },
        };
      } catch (err) {
        onTrace("cre", `DON trigger failed ${err instanceof Error ? err.message : ""}`.trim());
        return cre;
      }
    }
    return cre;
  }

  onTrace("graph", "live GraphQL two protocols Messari 3.1.0");
  const snapshot = await liveSnapshot(cfg, request, policy, onTrace);
  for (const p of snapshot.protocols) {
    onTrace(
      "graph",
      `${p.slug} schemaVersion ${p.schemaVersion} block ${p.block ?? "?"} id ${p.deploymentId}`,
    );
  }
  onTrace("cre", "HOP_JOIN=inline (same join as cre/hop-query)");
  const joined = joinAndAggregate(policy, snapshot, request);
  return {
    ...joined,
    aggregate: sanitizeAggregate(joined.aggregate),
    cre: {
      mode: "simulation",
      artifact: "handlerInTee-inline",
      trigger: "http",
    },
  };
}

async function simulateCre(
  cfg: AppConfig,
  request: QueryRequest,
  onTrace: (rail: "graph" | "cre", msg: string) => void,
): Promise<JoinOutcome> {
  const workflowDir = path.join(cfg.creCwd, "hop-query");
  await writeFile(path.join(workflowDir, "config.runtime.json"), JSON.stringify(creConfig(cfg, request), null, 2));
  await writeFile(
    path.join(workflowDir, "http-payload.json"),
    JSON.stringify({
      query: request.query,
      protocols: request.protocols,
      max_block_lag: request.max_block_lag,
      window: request.window,
    }),
  );

  const envFile = path.join(cfg.creCwd, ".env");
  const args = [
    "workflow",
    "simulate",
    "hop-query",
    "--target",
    "staging-settings",
    "--non-interactive",
    "--trigger-index",
    "0",
    "--http-payload",
    "@hop-query/http-payload.json",
    "--env",
    envFile,
  ];
  onTrace("cre", `${cfg.creCli} ${args.join(" ")}`);

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(cfg.creCli, args, {
      cwd: cfg.creCwd,
      shell: false,
      env: {
        ...process.env,
        HOP_POLICY_TABLE_JSON: cfg.policyJson,
        GRAPH_API_KEY: cfg.graphApiKey,
      },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("cre_timeout"));
    }, 180_000);
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
      else resolve(`${out}\n${err}`);
    });
  });

  const json = extractJson(stdout);
  if (json && json.error === "policy_unavailable") {
    throw Object.assign(new Error("policy_unavailable"), { code: "policy_unavailable" });
  }
  if (!json || json.error) {
    throw new Error(json?.error ?? "cre_no_result");
  }
  if (!json.status) {
    throw new Error("cre_no_result");
  }
  const teeBanner = /TEE Execution|AWS Nitro/i.test(stdout);
  onTrace("cre", teeBanner ? "TEE requested AWS Nitro us-west-2" : "CRE HTTP trigger");
  return {
    status: json.status,
    aggregate: sanitizeAggregate(json.aggregate),
    k_anon: json.k_anon ?? { result: "not_applicable" },
    graph: json.graph ?? { deployments: [] },
    policy: json.policy ?? { version: "unknown", threshold_hash: hashAggregate({}) },
    cre: {
      mode: json.cre?.mode === "don" ? "don" : "simulation",
      artifact: json.cre?.artifact ?? stdout.replace(/\s+/g, " ").slice(-1500),
      tee: json.cre?.tee ?? "nitro:us-west-2",
      trigger: "http",
      report_hash: json.cre?.report_hash,
    },
  };
}

function extractJson(text: string): (JoinOutcome & { error?: string }) | null {
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
