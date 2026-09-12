export function priceTinybars(
  base: string,
  protocolCount: number,
  extraPerProtocol: string,
  publicUtil: number | undefined,
  utilScale: string,
): string {
  let n = big(base);
  const extra = big(extraPerProtocol);
  if (protocolCount > 1 && extra > 0n) {
    n += extra * BigInt(protocolCount - 1);
  }
  const scale = big(utilScale);
  if (scale > 0n && publicUtil !== undefined && Number.isFinite(publicUtil) && publicUtil > 0) {
    n += BigInt(Math.max(0, Math.floor(publicUtil * Number(scale))));
  }
  if (n < 1n) n = 1n;
  return n.toString();
}

function big(raw: string): bigint {
  try {
    const n = BigInt(raw || "0");
    return n < 0n ? 0n : n;
  } catch {
    return 0n;
  }
}
