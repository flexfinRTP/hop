/**
 * Hedera exact x402 via Blocky402.
 * extra.feePayer MUST equal GET {facilitator}/supported (kinds extra.feePayer or signers["hedera:*"][0]).
 * Do not hardcode feePayer. Do not proxy Graph Base USDC x402.
 */
export async function facilitatorSupportedUrl(): Promise<string> {
  const base = process.env.BLOCKY402_FACILITATOR_URL;
  if (!base) throw new Error("BLOCKY402_FACILITATOR_URL missing");
  return `${base.replace(/\/$/, "")}/supported`;
}
