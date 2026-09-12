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
