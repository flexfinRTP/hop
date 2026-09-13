import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { canonicalJson } from "@hop/shared";
import { privateKeyToAccount } from "viem/accounts";
import type { AppConfig } from "./config.js";
import { postRaw } from "./http.js";

const PRIVATE_GATEWAY = "https://01.enterprise-gateway.zone-a.cre.chain.link/";
const PUBLIC_GATEWAY = "https://01.gateway.zone-a.cre.chain.link";

function asHexKey(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function creEvmAddress(privateKey: string): string | undefined {
  const trimmed = privateKey.trim();
  if (!trimmed) return undefined;
  try {
    return privateKeyToAccount(asHexKey(trimmed)).address;
  } catch {
    return undefined;
  }
}

export async function triggerDeployedWorkflow(
  cfg: AppConfig,
  input: Record<string, unknown>,
): Promise<{ execution_id?: string; workflow_id?: string; status?: string }> {
  if (!cfg.creWorkflowId || !cfg.creEthPrivateKey) {
    throw new Error("cre_gateway_unconfigured");
  }
  const account = privateKeyToAccount(asHexKey(cfg.creEthPrivateKey));
  const body = {
    id: randomUUID(),
    jsonrpc: "2.0",
    method: "workflows.execute",
    params: {
      input,
      workflow: { workflowID: cfg.creWorkflowId.replace(/^0x/, "") },
    },
  };
  const serialized = canonicalJson(body);
  const digest = `0x${createHash("sha256").update(serialized).digest("hex")}`;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "ETH", typ: "JWT" })));
  const payload = b64url(
    Buffer.from(
      canonicalJson({
        digest,
        exp: now + 240,
        iat: now,
        iss: account.address,
        jti: randomUUID(),
      }),
    ),
  );
  const message = `${header}.${payload}`;
  const sigHex = await account.signMessage({ message });
  const jwt = `${message}.${b64url(Buffer.from(sigHex.slice(2), "hex"))}`;
  const gateway = (cfg.creGatewayUrl || PRIVATE_GATEWAY).replace(/\/?$/, "/").replace(/\/$/, "");
  const url = gateway === PUBLIC_GATEWAY.replace(/\/$/, "") ? PUBLIC_GATEWAY : `${gateway}/`;
  const res = await postRaw(
    url,
    serialized,
    {
      Authorization: `Bearer ${jwt}`,
    },
    30_000,
  );
  const json = JSON.parse(res.text) as {
    result?: { workflow_execution_id?: string; workflow_id?: string; status?: string };
    error?: { message?: string };
  };
  if (res.status >= 400 || json.error) {
    throw new Error(json.error?.message ?? `cre_gateway_${res.status}`);
  }
  return {
    execution_id: json.result?.workflow_execution_id,
    workflow_id: json.result?.workflow_id,
    status: json.result?.status,
  };
}

export type DonExecutionReport = {
  execution_id: string;
  status?: string;
  executed_in_tee?: boolean;
  commitment_hash?: string;
};

const DON_POLL_ATTEMPTS = 4;
const DON_POLL_MS = 2_000;
const DON_STATUS_VALUES = new Set(["SUCCESS", "FAILURE", "ACCEPTED", "IN_PROGRESS", "TRIGGERED"]);
const HEX64 = /^[a-f0-9]{64}$/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnCreJson(cfg: AppConfig, args: string[], timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(cfg.creCli, args, {
      cwd: cfg.creCwd,
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("cre_execution_timeout"));
    }, timeoutMs);
    child.stdout?.on("data", (data) => {
      out += String(data);
    });
    child.stderr?.on("data", (data) => {
      err += String(data);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = `${out}\n${err}`;
      const parsed = extractJsonValue(text);
      if (parsed !== undefined) {
        resolve(parsed);
        return;
      }
      if (code !== 0) reject(new Error(err.trim().slice(-240) || `cre_execution_exit_${code}`));
      else reject(new Error("cre_execution_no_json"));
    });
  });
}

function extractJsonValue(text: string): unknown {
  const matches = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/g);
  if (!matches) return undefined;
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]!);
    } catch {
      continue;
    }
  }
  return undefined;
}

function inspectDonPayload(value: unknown): {
  status?: string;
  executed_in_tee?: boolean;
  commitment_hash?: string;
} {
  const found: {
    status?: string;
    executed_in_tee?: boolean;
    commitment_hash?: string;
    hashes: string[];
  } = { hashes: [] };
  walk(value, found);
  return {
    status: found.status,
    executed_in_tee: found.executed_in_tee,
    commitment_hash: found.commitment_hash,
  };
}

function walk(
  value: unknown,
  found: {
    status?: string;
    executed_in_tee?: boolean;
    commitment_hash?: string;
    hashes: string[];
  },
): void {
  if (typeof value === "string") {
    if (HEX64.test(value)) found.hashes.push(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "cre_commitment_hash" || key === "commitment_hash") && typeof item === "string" && HEX64.test(item)) {
      found.commitment_hash = item;
    }
    if ((key === "executedInTee" || key === "executed_in_tee") && typeof item === "boolean") {
      found.executed_in_tee = item;
    }
    if (key === "status" && typeof item === "string" && DON_STATUS_VALUES.has(item)) {
      found.status = item;
    }
    walk(item, found);
  }
}

export async function fetchDonExecution(
  cfg: AppConfig,
  executionId: string,
): Promise<DonExecutionReport> {
  const id = executionId.trim();
  if (!id) throw new Error("cre_execution_id_missing");
  let last: DonExecutionReport = { execution_id: id };
  for (let attempt = 0; attempt < DON_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(DON_POLL_MS);
    const statusJson = await spawnCreJson(cfg, ["execution", "status", id, "--json"], 20_000);
    const fromStatus = inspectDonPayload(statusJson);
    last = {
      execution_id: id,
      status: fromStatus.status,
      executed_in_tee: fromStatus.executed_in_tee,
      commitment_hash: fromStatus.commitment_hash,
    };
    if (last.status === "SUCCESS" && !last.commitment_hash) {
      try {
        const eventsJson = await spawnCreJson(cfg, ["execution", "events", id, "--json"], 20_000);
        const fromEvents = inspectDonPayload(eventsJson);
        last.commitment_hash = fromEvents.commitment_hash ?? last.commitment_hash;
        last.executed_in_tee = fromEvents.executed_in_tee ?? last.executed_in_tee;
      } catch {
        // Events are optional; status SUCCESS without a commitment is not a hash match.
      }
    }
    if (last.status === "SUCCESS" || last.status === "FAILURE") return last;
  }
  return last;
}
