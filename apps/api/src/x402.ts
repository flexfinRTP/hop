import type { AppConfig } from "./config.js";
import type { PaymentRequirements } from "@hop/shared";

type Supported = {
  kinds?: { scheme?: string; network?: string; extra?: { feePayer?: string } }[];
  signers?: Record<string, string[]>;
};

export async function facilitatorFeePayer(cfg: AppConfig): Promise<string> {
  const url = `${cfg.facilitatorUrl.replace(/\/$/, "")}/supported`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`facilitator_supported_${res.status}`);
  const json = (await res.json()) as Supported;
  const kind = json.kinds?.find((k) => k.network === "hedera:testnet");
  const feePayer = kind?.extra?.feePayer ?? json.signers?.["hedera:*"]?.[0];
  if (!feePayer) throw new Error("facilitator_fee_payer_missing");
  return feePayer;
}

export function decodePayment(header: string): unknown {
  const trimmed = header.trim();
  try {
    return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error("bad_payment");
    }
  }
}

export function encodeJsonHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

type VerifyResult = { isValid?: boolean; payer?: string; invalidReason?: string; invalidMessage?: string };
type SettleResult = {
  success?: boolean;
  transaction?: string;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
};

async function postFacilitator<T>(
  cfg: AppConfig,
  path: "/verify" | "/settle",
  paymentPayload: unknown,
  paymentRequirements: PaymentRequirements,
): Promise<T> {
  const res = await fetch(`${cfg.facilitatorUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      x402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  const json = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error((json as { message?: string }).message ?? `facilitator_${path}_${res.status}`);
  }
  return json;
}

export async function verifyPayment(
  cfg: AppConfig,
  paymentPayload: unknown,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResult> {
  return postFacilitator<VerifyResult>(cfg, "/verify", paymentPayload, paymentRequirements);
}

export async function settlePayment(
  cfg: AppConfig,
  paymentPayload: unknown,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResult> {
  return postFacilitator<SettleResult>(cfg, "/settle", paymentPayload, paymentRequirements);
}

export function paymentFromHeaders(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  return c.req.header("PAYMENT-SIGNATURE") || c.req.header("X-PAYMENT") || c.req.header("x-payment");
}
