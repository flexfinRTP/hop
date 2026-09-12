import { Hono } from "hono";
import { loadConfig, requirements } from "../config.js";
import { rateOk } from "../rate-limit.js";
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
  const feePayer = body.requirements?.extra?.feePayer || (await facilitatorFeePayer(cfg));
  const reqs = body.requirements ?? requirements(cfg, feePayer);
  if (reqs.payTo && reqs.payTo !== cfg.payTo) {
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
