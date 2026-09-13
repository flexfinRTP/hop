import { Hono } from "hono";
import {
  GENESIS_CHAIN,
  POSTURE,
  QUERY_TYPES,
  chainHash,
  decisionReceiptFromEvidence,
  evaluateMandate,
  hashJson,
  hopReason,
  parseMandate,
  parsePolicyTable,
  peacFromEvidence,
  peacHash,
  type Evidence,
  type Mandate,
  type QueryRequest,
  type QueryType,
} from "@hop/shared";
import { loadConfig, queryParams, quoteAmount, requirements } from "../config.js";
import { cachedPublicUtil, checkGraphReadiness } from "../graph.js";
import { submitReceiptHash } from "../hcs.js";
import { checkCreCli, runJoin } from "../join-run.js";
import { allowPayer, rateOk } from "../rate-limit.js";
import {
  claimDurableRequest,
  claimIdempotency,
  claimPayment,
  releaseIdempotency,
  releaseDurableClaim,
  releasePayment,
  currentChain,
  emit,
  enqueueHcsEvidence,
  getByIdempotency,
  getSpend,
  getTrace,
  hopsInWindow,
  newId,
  paymentHashOf,
  paymentReplay,
  put,
  rememberDemoQuote,
  releaseMandate,
  reserveMandate,
  updateDurableClaim,
} from "../store.js";
import {
  decodePayment,
  encodeJsonHeader,
  facilitatorFeePayer,
  paymentFromHeaders,
  settlePayment,
  verifyPayment,
} from "../x402.js";
import { hashNullifier, readWorldToken, worldReady } from "../world.js";

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

function validProtocolSelection(
  cfg: ReturnType<typeof loadConfig>,
  requested: string[],
): boolean {
  const resolved = requested.map((value) =>
    cfg.protocols.find((protocol) => protocol.key === value || protocol.slug === value),
  );
  const keys = resolved.map((protocol) => protocol?.key).filter((key): key is string => Boolean(key));
  return (
    resolved.every((protocol) => Boolean(protocol?.url)) &&
    keys.length === requested.length &&
    new Set(keys).size === requested.length
  );
}

function resolveMandate(
  c: { req: { header: (name: string) => string | undefined } },
  fallback: string,
): { mandate: Mandate | null; error?: string } {
  const header = c.req.header("X-Hop-Mandate") || c.req.header("x-hop-mandate");
  const server = parseMandate(fallback);
  if (header) {
    const client = parseMandate(header);
    if (!client) return { mandate: null, error: "bad_mandate" };
    if (server) {
      return { mandate: { ...server, agent_id: client.agent_id || server.agent_id } };
    }
    return { mandate: client };
  }
  return { mandate: server };
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
  if (!validProtocolSelection(cfg, parsed.protocols)) {
    return c.json(
      {
        error: "bad_protocols",
        detail: "Choose one or two configured protocol keys or slugs from GET /v1/meta.",
      },
      400,
    );
  }
  if (cfg.hopJoin === "cre") {
    if (!cfg.graphApiKey || !cfg.policyCommitmentSalt) {
      emit(traceId, "cre", "required CRE secrets unavailable");
      return c.json({ error: "cre_secrets_unconfigured" }, 503);
    }
    const creCli = await checkCreCli(cfg);
    if (!creCli.ok) {
      emit(traceId, "cre", `CRE CLI unavailable: ${creCli.detail}`);
      return c.json(
        {
          error: "cre_unavailable",
          detail: "The CRE CLI is unavailable or not authenticated.",
          trace: getTrace(traceId),
        },
        503,
      );
    }
  }
  if (cfg.worldRequired && !worldReady(cfg)) {
    emit(traceId, "world", "world_unconfigured");
    return c.json({ error: "world_unconfigured" }, 503);
  }
  const graphReadiness = await checkGraphReadiness(
    cfg,
    parsed.protocols,
    parsed.max_block_lag,
  );
  if (!graphReadiness.ok) {
    emit(traceId, "graph", graphReadiness.error ?? "graph_unavailable");
    return c.json({
      error: "graph_unavailable",
      detail: graphReadiness.error,
      sources: graphReadiness.sources,
    }, 503);
  }

  const publicUtil = cachedPublicUtil(parsed);
  const amount = quoteAmount(cfg, parsed.protocols.length, publicUtil);
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
    const accepts = [requirements(cfg, feePayer, amount)];
    if (cfg.demoSign) rememberDemoQuote(accepts[0]);
    const required = {
      x402Version: 2 as const,
      resource: { url: "/v1/query", mimeType: "application/json" },
      accepts,
    };
    emit(
      traceId,
      "hedera",
      `402 hedera:testnet asset ${cfg.asset} amount ${amount} feePayer ${feePayer}`,
    );
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
        receipt: decisionReceiptFromEvidence(existing.json, {
          semantics: "idempotent_replay",
          settled: false,
        }),
        reason: existing.json.reason,
        mandate: existing.json.mandate,
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

  const payHash = paymentHashOf(payload);
  if (paymentReplay(payHash, idem) === "replay") {
    emit(traceId, "hedera", "X-PAYMENT replay");
    return c.json({ error: "payment_replay" }, 400);
  }

  if (cfg.protocols.filter((p) => p.url).length < 1) {
    emit(traceId, "graph", "graph_unconfigured");
    return c.json({ error: "graph_unconfigured" }, 503);
  }

  let feePayer: string;
  try {
    feePayer = await facilitatorFeePayer(cfg);
  } catch {
    return c.json({ error: "facilitator_unavailable" }, 503);
  }
  const reqs = requirements(cfg, feePayer, amount);

  const resolved = resolveMandate(c, cfg.mandateJson);
  if (resolved.error) {
    emit(traceId, "hop", "bad_mandate");
    return c.json({ error: "bad_mandate" }, 400);
  }
  const mandate = resolved.mandate;
  if (cfg.mandateRequired && !mandate) {
    emit(traceId, "hop", "mandate_required");
    return c.json({ error: "mandate_required" }, 403);
  }

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

  const worldToken = c.req.header("X-Hop-World") || c.req.header("x-hop-world");
  const worldSession = readWorldToken(cfg, worldToken);
  if (cfg.worldRequired && worldReady(cfg) && !worldSession) {
    emit(traceId, "world", "world_required");
    return c.json({ error: "world_required" }, 403);
  }
  if (worldSession) {
    emit(traceId, "world", "unique human");
  }

  const claim = claimIdempotency(idem, bodyHash);
  if (claim.status === "conflict") {
    return c.json({ error: "idempotency_conflict" }, 400);
  }
  if (claim.status === "pending") {
    await claim.wait;
    const completed = getByIdempotency(idem);
    if (!completed) {
      return c.json({ error: "idempotency_incomplete" }, 409);
    }
    emit(traceId, "hedera", "Idempotency-Key joined in-flight request; no second settle");
    return c.json(
      {
        status: completed.json.status,
        aggregate: completed.aggregate,
        evidence: completed.json,
        receipt: decisionReceiptFromEvidence(completed.json, {
          semantics: "idempotent_replay",
          settled: false,
        }),
        reason: completed.json.reason,
        mandate: completed.json.mandate,
        trace: getTrace(traceId),
      },
      200,
    );
  }

  if (claimPayment(payHash, idem) === "replay") {
    releaseIdempotency(idem);
    emit(traceId, "hedera", "X-PAYMENT replay in flight");
    return c.json({ error: "payment_replay" }, 400);
  }

  const durable = await claimDurableRequest({
    idempotencyKey: idem,
    bodyHash,
    paymentHash: payHash,
    requestPayload: parsed,
  }).catch((error) => {
    emit(traceId, "hop", `durable claim failed ${String(error)}`);
    return null;
  });
  if (!durable && cfg.databaseUrl) {
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
    return c.json({ error: "storage_unavailable" }, 503);
  }
  if (durable?.status === "conflict") {
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
    return c.json({ error: "idempotency_conflict" }, 400);
  }
  if (durable?.status === "payment_replay") {
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
    return c.json({ error: "payment_replay" }, 400);
  }
  if (durable?.status === "existing" && durable.evidence) {
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
    const stored = durable.evidence as {
      json?: Evidence;
      aggregate?: Record<string, unknown>;
    };
    if (stored.json) {
      return c.json({
        status: stored.json.status,
        aggregate: stored.aggregate,
        evidence: stored.json,
        receipt: decisionReceiptFromEvidence(stored.json, {
          semantics: "idempotent_replay",
          settled: false,
        }),
        reason: stored.json.reason,
        mandate: stored.json.mandate,
        trace: getTrace(traceId),
      });
    }
  }
  if (durable?.status === "in_flight") {
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
    return c.json(
      {
        error: "request_in_progress",
        state: durable.claim.state,
        settlement: durable.claim.settlementRef,
      },
      409,
    );
  }

  let durableState: "disabled" | "claimed" | "verified" | "settling" | "settled" | "fulfilled" =
    durable?.status === "acquired" ? "claimed" : "disabled";

  try {
  const amountN = Number(amount);
  let reserved: Mandate | null = null;
  let mandateReservationId: string | undefined;
  let decision: ReturnType<typeof evaluateMandate> | undefined;
  if (mandate) {
    const now = Date.now();
    const bound = mandate.pay_to ? mandate : { ...mandate, pay_to: cfg.payTo };
    decision = evaluateMandate(bound, {
      payTo: cfg.payTo,
      amountTinybars: amountN,
      query: parsed.query,
      maxBlockLag: parsed.max_block_lag,
      now,
      spentTinybars: getSpend(bound.id).spent_tinybars,
      hopsInWindow: hopsInWindow(bound.id, bound.window_s, now),
      confirmed: c.req.header("X-Hop-Confirm") === "1" || c.req.header("x-hop-confirm") === "1",
    });
    emit(traceId, "hop", `${decision.result} ${decision.reason}`);
    if (decision.result === "DENY") {
      return c.json({ error: decision.reason, mandate: decision }, 403);
    }
    if (decision.result === "REVIEW") {
      return c.json({ error: "mandate_review", mandate: decision }, 403);
    }
    reserved = bound;
    mandateReservationId = reserveMandate(bound.id, amountN, now);
  }

  if (!parsePolicyTable(cfg.policyJson)) {
    if (reserved && mandateReservationId) releaseMandate(reserved.id, mandateReservationId);
    emit(traceId, "cre", "policy_unavailable");
    return c.json({ error: "policy_unavailable" }, 503);
  }

  if (durableState !== "disabled") {
    await updateDurableClaim(idem, "verified", { payer });
    durableState = "verified";
  }
  emit(traceId, "hedera", "POST Blocky402 /settle");
  if (durableState !== "disabled") {
    await updateDurableClaim(idem, "settling", { payer });
    durableState = "settling";
  }
  let settle: { success?: boolean; transaction?: string; payer?: string };
  try {
    settle = await settlePayment(cfg, payload, reqs);
  } catch {
    if (reserved && mandateReservationId) releaseMandate(reserved.id, mandateReservationId);
    return c.json({ error: "bad_payment" }, 400);
  }
  if (!settle.success) {
    if (reserved && mandateReservationId) releaseMandate(reserved.id, mandateReservationId);
    if (durableState !== "disabled") {
      await updateDurableClaim(idem, "verified", { payer, errorCode: "settle_rejected" });
      durableState = "verified";
    }
    emit(traceId, "hedera", "settle failed");
    return c.json({ error: "bad_payment" }, 400);
  }
  const settlementRef = settle.transaction ?? "";
  if (durableState !== "disabled") {
    await updateDurableClaim(idem, "settled", { payer, settlementRef });
    durableState = "settled";
  }
  emit(traceId, "hedera", `settlement ${settlementRef}`);

  let joined;
  try {
    joined = await runJoin(cfg, parsed, (rail, msg) => emit(traceId, rail, msg));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "join_error";
    emit(traceId, "graph", `join failed after settle: ${detail}`);
    joined = {
      status: "stale" as const,
      k_anon: { result: "not_applicable" as const },
      graph: { deployments: [] },
      policy: { version: "unknown", threshold_hash: hashJson({}) },
      cre: { mode: "simulation" as const, artifact: detail.slice(0, 240) },
    };
  }

  const id = newId();
  const reason = hopReason(joined);
  const prev = currentChain().prev || GENESIS_CHAIN;
  const mandateHash = decision?.mandate_hash;
  const link = chainHash({
    id,
    aggregate_hash: hashJson(joined.aggregate ?? { omitted: true }),
    settlement: settlementRef,
    prev,
    mandate_hash: mandateHash,
  });
  const spent = reserved ? getSpend(reserved.id) : undefined;

  const evidence: Evidence = {
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
    hcs_seq: undefined,
    world: worldSession ? { nullifier_hash: hashNullifier(worldSession.nullifier_hash) } : undefined,
    mandate: reserved && decision
      ? {
          id: reserved.id,
          hash: decision.mandate_hash,
          remaining_tinybars: Math.max(0, reserved.max_tinybars - (spent?.spent_tinybars ?? 0)),
          remaining_hops: decision.remaining_hops,
          decision: decision.result,
        }
      : undefined,
    chain: { prev, hash: link },
    meter: { amount, protocols: parsed.protocols.length, util: publicUtil },
    reason,
    posture: {
      ...POSTURE,
      cre: joined.cre.mode,
      world: worldSession ? "unique_human" : "off",
    },
  };
  const hcsPayload = {
    aggregateHash: evidence.aggregate_hash,
    settlementRef,
    extra: {
      mandate_hash: mandateHash,
      chain_hash: link,
      policy_hash: evidence.policy.threshold_hash,
      cre_commitment_hash:
        joined.cre.cre_commitment_hash ?? joined.cre.report_hash,
      world_hash: evidence.world?.nullifier_hash,
    },
  };
  let hcsAnchored = false;
  try {
    const anchor = await submitReceiptHash(
      cfg,
      id,
      hcsPayload.aggregateHash,
      hcsPayload.settlementRef,
      hcsPayload.extra,
    );
    if (anchor) {
      evidence.hcs_seq = anchor.sequence;
      evidence.hcs_topic = anchor.topic;
      hcsAnchored = true;
      emit(traceId, "hedera", `HCS ${anchor.topic} seq ${anchor.sequence}`);
    }
  } catch {
    emit(traceId, "hedera", "HCS submit skipped");
  }
  evidence.peac_hash = peacHash(peacFromEvidence(evidence));

  await put({
    id,
    idempotencyKey: idem,
    bodyHash,
    paymentHash: payHash,
    json: evidence,
    aggregate: joined.aggregate,
    settled: true,
    storedAt: Date.now(),
  });
  if (!hcsAnchored) {
    await enqueueHcsEvidence(id, hcsPayload).catch(() => undefined);
  }
  if (durableState !== "disabled") {
    await updateDurableClaim(idem, "fulfilled", {
      payer,
      settlementRef,
      evidenceId: id,
    });
    durableState = "fulfilled";
  }

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
      receipt: decisionReceiptFromEvidence(evidence, {
        semantics: "attempt",
        settled: true,
      }),
      reason,
      mandate: evidence.mandate,
      trace: getTrace(traceId),
    },
    200,
  );
  } finally {
    if (durableState === "claimed" || durableState === "verified") {
      await releaseDurableClaim(idem).catch(() => undefined);
    }
    releasePayment(payHash, idem);
    releaseIdempotency(idem);
  }
});
