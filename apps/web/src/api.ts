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

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, init);
}

export async function postQuery(
  body: QueryBody,
  opts: { payment?: string; idem?: string; traceId: string },
): Promise<{ status: number; json: Record<string, unknown>; paymentRequired?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hop-Trace": opts.traceId,
  };
  if (opts.payment) headers["X-PAYMENT"] = opts.payment;
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  const res = await api("/v1/query", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    status: res.status,
    json,
    paymentRequired: res.headers.get("PAYMENT-REQUIRED") ?? undefined,
  };
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
