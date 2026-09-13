import { Hono } from "hono";
import { loadConfig, requirements } from "../config.js";
import { rateOk } from "../rate-limit.js";
import { consumeDemoQuote } from "../store.js";
import { facilitatorFeePayer } from "../x402.js";

export const demo = new Hono();

demo.post("/sign", async (c) => {
  const cfg = loadConfig();
  if (!cfg.demoSign || !cfg.demoAccountId || !cfg.demoPrivateKey) {
    return c.json({ error: "demo_sign_disabled" }, 403);
  }
  if (!rateOk("demo-sign", cfg.rateLimitPerMin)) {
    return c.json({ error: "rate_limited" }, 429);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    requirements?: ReturnType<typeof requirements>;
  };
  if (!body.requirements) {
    return c.json({ error: "demo_quote_required" }, 400);
  }
  let feePayer: string;
  try {
    feePayer = await facilitatorFeePayer(cfg);
  } catch {
    return c.json({ error: "facilitator_unavailable" }, 503);
  }
  const reqs = body.requirements;
  const valid =
    reqs.scheme === "exact" &&
    reqs.network === cfg.network &&
    reqs.asset === cfg.asset &&
    reqs.payTo === cfg.payTo &&
    reqs.maxTimeoutSeconds === cfg.maxTimeoutSeconds &&
    reqs.extra?.feePayer === feePayer &&
    /^\d+$/.test(reqs.amount) &&
    Number(reqs.amount) > 0;
  if (!valid || !consumeDemoQuote(reqs)) {
    return c.json({ error: "bad_payment" }, 400);
  }
  try {
    const { ExactHederaScheme } = await import("@x402/hedera/exact/client");
    const mod = await import("@x402/hedera");
    const PrivateKey = mod.PrivateKey;
    const signer = mod.createClientHederaSigner(
      cfg.demoAccountId,
      PrivateKey.fromStringECDSA(cfg.demoPrivateKey),
      { network: "hedera:testnet" },
    );
    const scheme = new ExactHederaScheme(signer);
    const signed = await scheme.createPaymentPayload(2, reqs);
    const paymentPayload = {
      x402Version: 2,
      scheme: "exact",
      network: "hedera:testnet",
      accepted: reqs,
      payload: signed.payload ?? signed,
    };
    return c.json({
      payment: Buffer.from(JSON.stringify(paymentPayload)).toString("base64"),
    });
  } catch (err) {
    return c.json({ error: "demo_sign_failed", detail: String(err) }, 500);
  }
});
