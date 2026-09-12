export type QueryType =
  | "market_params"
  | "position_counts"
  | "liquidations"
  | "policy_check"
  | "account_ltv";

export type QueryBody = {
  query: QueryType;
  protocols: string[];
  max_block_lag: number;
  window?: { from: string; to: string };
};

export type MandateView = {
  id: string;
  agent_id: string;
  max_tinybars: number;
  max_hops: number;
  remaining_tinybars: number;
  remaining_hops: number;
  human_threshold_tinybars: number;
  expires_at: string;
  template: Record<string, unknown>;
};

export type Meta = {
  demo_sign: boolean;
  wall_buffer: number;
  graph_ready: boolean;
  asset: string;
  amount: string;
  meter_per_protocol?: string;
  protocols: { key: string; slug: string; id: string; configured: boolean }[];
  labels: { cre: string; rails: string; demoGraph: string; mandate?: string; peac?: string; hcs?: string; world?: string };
  posture?: { custody: string; ofac: string; mor: string; cre?: string };
  mandate?: MandateView | null;
  mandate_required?: boolean;
  hcs?: { ready: boolean; topic: string | null; auto: boolean };
  hop_join?: string;
  cre?: { join: string; tee: string; trigger: string; workflow_id: string | null };
  world?: {
    ready: boolean;
    required: boolean;
    app_id: string | null;
    rp_id: string | null;
    action: string;
    environment: "staging" | "production";
  };
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init);
}

export async function getMeta(): Promise<Meta> {
  const res = await api("/v1/meta");
  if (!res.ok) throw new Error(`meta_${res.status}`);
  const json = (await res.json()) as Meta;
  if (!json || typeof json !== "object" || !Array.isArray(json.protocols)) {
    throw new Error("meta_shape");
  }
  return json;
}

export function openTrace(traceId: string, onEvent: (ev: { t: string; rail: string; msg: string }) => void): () => void {
  const es = new EventSource(`/v1/events/${traceId}`);
  es.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as { t: string; rail: string; msg: string });
    } catch {
      return;
    }
  };
  return () => es.close();
}

export async function postQuery(
  body: QueryBody,
  opts: { payment?: string; idem?: string; traceId: string; mandate?: string; confirm?: boolean; world?: string },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hop-Trace": opts.traceId,
  };
  if (opts.payment) headers["X-PAYMENT"] = opts.payment;
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  if (opts.mandate) headers["X-Hop-Mandate"] = opts.mandate;
  if (opts.confirm) headers["X-Hop-Confirm"] = "1";
  if (opts.world) headers["X-Hop-World"] = opts.world;
  const res = await api("/v1/query", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function signDemo(requirements: unknown): Promise<string> {
  const res = await api("/v1/demo/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirements }),
  });
  const json = (await res.json()) as { payment?: string; error?: string };
  if (!res.ok || !json.payment) throw new Error(json.error ?? "demo_sign_failed");
  return json.payment;
}

export async function getEvidence(id: string): Promise<unknown> {
  const res = await api(`/v1/evidence/${id}`);
  return res.json();
}

export async function getPeac(id: string): Promise<unknown> {
  const res = await api(`/v1/evidence/${id}/peac`);
  return res.json();
}

export async function getVerify(id: string): Promise<unknown> {
  const res = await api(`/v1/evidence/${id}/verify`);
  return res.json();
}

export async function worldRpContext(): Promise<{
  rp_id: string;
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}> {
  const res = await api("/v1/world/rp-context", { method: "POST" });
  const json = (await res.json()) as {
    rp_id?: string;
    sig?: string;
    nonce?: string;
    created_at?: number;
    expires_at?: number;
    error?: string;
  };
  if (!res.ok || !json.rp_id || !json.sig) throw new Error(json.error ?? "world_rp");
  return {
    rp_id: json.rp_id,
    sig: json.sig,
    nonce: json.nonce ?? "",
    created_at: json.created_at ?? 0,
    expires_at: json.expires_at ?? 0,
  };
}

export async function worldVerify(idkitResponse: unknown): Promise<{ token: string }> {
  const res = await api("/v1/world/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idkitResponse }),
  });
  const json = (await res.json()) as { token?: string; error?: string };
  if (!res.ok || !json.token) throw new Error(json.error ?? "world_verify");
  return { token: json.token };
}
