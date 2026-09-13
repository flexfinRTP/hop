import { randomUUID } from "node:crypto";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import {
  PrivateKey,
  createClientHederaSigner,
} from "@x402/hedera";

type PaymentRequirements = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

type HopMeta = {
  network: string;
  asset: string;
  payTo: string | null;
  query_types: string[];
  protocols: { key: string; configured: boolean }[];
  mandate?: { remaining_tinybars?: number } | null;
};

export type AutonomousQuery = {
  query: string;
  protocols: string[];
  maxBlockLag: number;
  mandate?: string;
  confirm?: boolean;
  worldToken?: string;
  passportToken?: string;
  agentDid?: string;
  erc8004?: string;
  idempotencyKey?: string;
};

export type AutonomousResult = {
  idempotency_key: string;
  payment: {
    network: string;
    asset: string;
    amount: string;
    pay_to: string;
    transaction?: string;
  };
  result: unknown;
  verification?: unknown;
};

const ACCOUNT = (process.env.HEDERA_PAYER_ID ?? "").trim();
const PRIVATE_KEY = (process.env.HEDERA_PAYER_KEY ?? "").trim();
const MAX_TINYBARS = BigInt(process.env.HOP_AGENT_MAX_TINYBARS ?? "5000000");

function jsonFromText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: "non_json_response", detail: text.slice(0, 500) };
  }
}

function paymentRequirements(
  response: Response,
  body: unknown,
): PaymentRequirements {
  const encoded = response.headers.get("PAYMENT-REQUIRED");
  if (encoded) {
    const envelope = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      accepts?: PaymentRequirements[];
    };
    if (envelope.accepts?.[0]) return envelope.accepts[0];
  }
  const envelope = body as { accepts?: PaymentRequirements[] };
  if (envelope.accepts?.[0]) return envelope.accepts[0];
  throw new Error("payment_requirements_missing");
}

function validatedAmount(value: unknown): bigint {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("payment_amount_invalid");
  }
  const amount = BigInt(value);
  if (amount <= 0n || amount > MAX_TINYBARS) throw new Error("payment_amount_out_of_policy");
  return amount;
}

function validateRequirements(
  requirements: PaymentRequirements,
  meta: HopMeta,
): bigint {
  const row = requirements as PaymentRequirements & {
    payTo?: string;
    amount?: string;
    scheme?: string;
    network?: string;
    asset?: string;
    extra?: { feePayer?: string };
  };
  if (row.scheme !== "exact") throw new Error("payment_scheme_denied");
  if (row.network !== meta.network || row.network !== "hedera:testnet") {
    throw new Error("payment_network_denied");
  }
  if (row.asset !== meta.asset) throw new Error("payment_asset_denied");
  if (!meta.payTo || row.payTo !== meta.payTo) throw new Error("payment_recipient_denied");
  if (!/^0\.0\.\d+$/.test(row.extra?.feePayer ?? "")) {
    throw new Error("payment_fee_payer_invalid");
  }
  const amount = validatedAmount(row.amount);
  if (
    typeof meta.mandate?.remaining_tinybars === "number" &&
    amount > BigInt(meta.mandate.remaining_tinybars)
  ) {
    throw new Error("mandate_budget_exceeded");
  }
  return amount;
}

function headersFor(input: AutonomousQuery): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.mandate) headers["X-Hop-Mandate"] = input.mandate;
  if (input.confirm) headers["X-Hop-Confirm"] = "1";
  if (input.worldToken) headers["X-Hop-World"] = input.worldToken;
  if (input.passportToken) headers["X-Hop-Passport"] = input.passportToken;
  if (input.agentDid) headers["X-Hop-Did"] = input.agentDid;
  if (input.erc8004) headers["X-Hop-Erc8004"] = input.erc8004;
  return headers;
}

async function responseJson(response: Response): Promise<unknown> {
  return jsonFromText(await response.text());
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function ensureRequest(input: AutonomousQuery, meta: HopMeta): void {
  if (!meta.query_types.includes(input.query)) throw new Error("query_type_denied");
  if (input.protocols.length < 1 || input.protocols.length > 2) {
    throw new Error("protocol_count_denied");
  }
  const configured = new Set(
    meta.protocols.filter((protocol) => protocol.configured).map((protocol) => protocol.key),
  );
  if (
    new Set(input.protocols).size !== input.protocols.length ||
    input.protocols.some((protocol) => !configured.has(protocol))
  ) {
    throw new Error("protocol_selection_denied");
  }
  if (!Number.isInteger(input.maxBlockLag) || input.maxBlockLag < 0) {
    throw new Error("max_block_lag_invalid");
  }
}

async function verifyResult(
  api: string,
  evidenceId: string,
): Promise<unknown> {
  const attempts = Math.max(1, Math.min(8, Number(process.env.HOP_AGENT_VERIFY_ATTEMPTS ?? 4)));
  let result: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchWithTimeout(
      `${api}/v1/evidence/${encodeURIComponent(evidenceId)}/verify?refresh=1`,
      {},
      20_000,
    );
    result = await responseJson(response);
    if ((result as { ok?: boolean }).ok) return result;
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  return result;
}

export async function autonomousHopQuery(
  api: string,
  input: AutonomousQuery,
): Promise<AutonomousResult> {
  if (!ACCOUNT || !PRIVATE_KEY) throw new Error("hedera_payer_unconfigured");

  const metaResponse = await fetchWithTimeout(`${api}/v1/meta`, {}, 20_000);
  const metaBody = await responseJson(metaResponse);
  if (!metaResponse.ok) throw new Error(`meta_http_${metaResponse.status}`);
  const meta = metaBody as HopMeta;
  ensureRequest(input, meta);

  const body = JSON.stringify({
    query: input.query,
    protocols: input.protocols,
    max_block_lag: input.maxBlockLag,
  });
  const baseHeaders = headersFor(input);
  const unpaid = await fetchWithTimeout(
    `${api}/v1/query`,
    { method: "POST", headers: baseHeaders, body },
    30_000,
  );
  const unpaidBody = await responseJson(unpaid);
  if (unpaid.status !== 402) {
    throw new Error(
      `quote_http_${unpaid.status}:${JSON.stringify(unpaidBody).slice(0, 500)}`,
    );
  }

  const requirements = paymentRequirements(unpaid, unpaidBody);
  const amount = validateRequirements(requirements, meta);
  const signer = createClientHederaSigner(
    ACCOUNT,
    PrivateKey.fromStringECDSA(PRIVATE_KEY),
    { network: "hedera:testnet" },
  );
  const signed = await new ExactHederaScheme(signer).createPaymentPayload(2, requirements);
  const payload = {
    x402Version: 2,
    payload: signed.payload,
    accepted: requirements,
  };
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const paid = await fetchWithTimeout(
    `${api}/v1/query`,
    {
      method: "POST",
      headers: {
        ...baseHeaders,
        "X-PAYMENT": Buffer.from(JSON.stringify(payload)).toString("base64"),
        "Idempotency-Key": idempotencyKey,
      },
      body,
    },
    240_000,
  );
  const paidBody = await responseJson(paid);
  if (!paid.ok) {
    throw new Error(`paid_http_${paid.status}:${JSON.stringify(paidBody).slice(0, 500)}`);
  }
  const result = paidBody as {
    evidence?: { id?: string };
  };
  const evidenceId = result.evidence?.id;
  const verification = evidenceId ? await verifyResult(api, evidenceId) : undefined;
  const paymentResponse = paid.headers.get("PAYMENT-RESPONSE");
  const settlement = paymentResponse
    ? (JSON.parse(Buffer.from(paymentResponse, "base64").toString("utf8")) as {
        transaction?: string;
      })
    : {};

  return {
    idempotency_key: idempotencyKey,
    payment: {
      network: meta.network,
      asset: meta.asset,
      amount: amount.toString(),
      pay_to: meta.payTo ?? "",
      transaction: settlement.transaction,
    },
    result: paidBody,
    verification,
  };
}
