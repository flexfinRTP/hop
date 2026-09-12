import { Hono } from "hono";
import {
  QUERY_TYPES,
  hashJson,
  parsePolicyTable,
  type QueryRequest,
  type QueryType,
} from "@hop/shared";
import { loadConfig, queryParams, requirements } from "../config.js";
import { runJoin } from "../join-run.js";
import { allowPayer, rateOk } from "../rate-limit.js";
import { emit, getByIdempotency, getTrace, newId, put } from "../store.js";
import {
  decodePayment,
  encodeJsonHeader,
  facilitatorFeePayer,
  paymentFromHeaders,
  settlePayment,
  verifyPayment,
} from "../x402.js";

function isQueryType(v: unknown): v is QueryType {
  return typeof v === "string" && (QUERY_TYPES as readonly string[]).includes(v);
}

function parseRequest(body: unknown): QueryRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "bad_body" };
  const raw = body as Record<string, unknown>;
  if (!isQueryType(raw.query)) return { error: "bad_query" };
  if (!Array.isArray(raw.protocols) || raw.protocols.length < 1 || raw.protocols.length > 2) {
    return { error: "bad_protocols" };
  }
  const lag = Number(raw.max_block_lag);
  if (!Number.isFinite(lag) || lag < 0) return { error: "bad_max_block_lag" };
  const req: QueryRequest = {
    query: raw.query,
    protocols: raw.protocols.map(String),
    max_block_lag: lag,
  };
  if (raw.window && typeof raw.window === "object") {
    const w = raw.window as { from?: string; to?: string };
    req.window = { from: String(w.from ?? ""), to: String(w.to ?? "") };
  }
  return req;
}

export const query = new Hono();

query.post("/", async (c) => {
  const cfg = loadConfig();
  const traceId = c.req.header("X-Hop-Trace") ?? newId();
  const bodyUnknown = await c.req.json().catch(() => null);
  const parsed = parseRequest(bodyUnknown);
  if ("error" in parsed) {
    return c.json({ error: parsed.error }, 400);
  }

  const paymentHeader = paymentFromHeaders(c);
  if (!paymentHeader) {
    emit(traceId, "hedera", "GET facilitator /supported");
    let feePayer: string;
    try {
      feePayer = await facilitatorFeePayer(cfg);
    } catch (err) {
      emit(traceId, "hedera", "facilitator /supported failed");
      return c.json({ error: "facilitator_unavailable", detail: String(err) }, 503);
    }
    if (!cfg.payTo) {
      return c.json({ error: "merchant_unconfigured" }, 503);
    }
    const accepts = [requirements(cfg, feePayer)];
    const required = {
      x402Version: 2 as const,
      resource: { url: "/v1/query", mimeType: "application/json" },
      accepts,
    };
    emit(traceId, "hedera", `402 hedera:testnet asset ${cfg.asset} feePayer ${feePayer}`);
    c.header("PAYMENT-REQUIRED", encodeJsonHeader(required));
    return c.json({ x402Version: 2, accepts, trace: getTrace(traceId) }, 402);
  }

  const idem = c.req.header("Idempotency-Key")?.trim();
  if (!idem) {
    return c.json({ error: "idempotency_required" }, 400);
  }

  const bodyHash = hashJson(parsed);
  const existing = getByIdempotency(idem);
  if (existing) {
    if (existing.bodyHash && existing.bodyHash !== bodyHash) {
      return c.json({ error: "idempotency_conflict" }, 400);
    }
    emit(traceId, "hedera", "Idempotency-Key replay; no second settle");
    return c.json(
      {
        status: existing.json.status,
        aggregate: existing.aggregate,
        evidence: existing.json,
        trace: getTrace(traceId),
      },
      200,
    );
  }

  let payload: unknown;
  try {
    payload = decodePayment(paymentHeader);
  } catch {
    return c.json({ error: "bad_payment" }, 400);
  }

  let feePayer: string;
  try {
    feePayer = await facilitatorFeePayer(cfg);
  } catch {
    return c.json({ error: "facilitator_unavailable" }, 503);
  }
  const reqs = requirements(cfg, feePayer);

  emit(traceId, "hedera", "POST Blocky402 /verify");
  let verify: { isValid?: boolean; payer?: string };
  try {
    verify = await verifyPayment(cfg, payload, reqs);
  } catch {
    return c.json({ error: "bad_payment" }, 400);
  }
  if (!verify.isValid) {
    emit(traceId, "hedera", "verify isValid=false");
    return c.json({ error: "bad_payment" }, 400);
  }
  const payer = verify.payer ?? "";
  if (!allowPayer(payer, cfg.payerAllowlist)) {
    return c.json({ error: "payer_denied" }, 403);
  }
  if (!rateOk(payer, cfg.rateLimitPerMin)) {
    return c.json({ error: "rate_limited" }, 429);
  }

  if (!parsePolicyTable(cfg.policyJson)) {
    emit(traceId, "cre", "policy_unavailable");
    return c.json({ error: "policy_unavailable" }, 503);
  }

  emit(traceId, "hedera", "POST Blocky402 /settle");
  let settle: { success?: boolean; transaction?: string; payer?: string };
  try {
    settle = await settlePayment(cfg, payload, reqs);
  } catch {
    return c.json({ error: "bad_payment" }, 400);
  }
  if (!settle.success) {
    emit(traceId, "hedera", "settle failed");
    return c.json({ error: "bad_payment" }, 400);
  }
  const settlementRef = settle.transaction ?? "";
  emit(traceId, "hedera", `settlement ${settlementRef}`);

  let joined;
  try {
    joined = await runJoin(cfg, parsed, (rail, msg) => emit(traceId, rail, msg));
  } catch {
    emit(traceId, "graph", "join failed after settle; stale");
    joined = {
      status: "stale" as const,
      k_anon: { result: "not_applicable" as const },
      graph: { deployments: [] },
      policy: { version: "unknown", threshold_hash: hashJson({}) },
      cre: { mode: "simulation" as const, artifact: "join_failed" },
    };
  }

  const id = newId();
  const evidence = {
    id,
    timestamp: new Date().toISOString(),
    payer_account: payer,
    query: { type: parsed.query, params: queryParams(parsed) },
    graph: joined.graph,
    policy: joined.policy,
    k_anon: joined.k_anon,
    aggregate_hash: hashJson(joined.aggregate ?? { omitted: true }),
    settlement: { ref: settlementRef },
    cre: joined.cre,
    status: joined.status,
  };

  put({
    id,
    idempotencyKey: idem,
    bodyHash,
    json: evidence,
    aggregate: joined.aggregate,
    settled: true,
  });

  c.header(
    "PAYMENT-RESPONSE",
    encodeJsonHeader({
      success: true,
      transaction: settlementRef,
      network: "hedera:testnet",
      payer,
    }),
  );

  return c.json(
    {
      status: joined.status,
      aggregate: joined.aggregate,
      evidence,
      trace: getTrace(traceId),
    },
    200,
  );
});
