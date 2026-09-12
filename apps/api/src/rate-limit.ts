const windows = new Map<string, number[]>();

export function allowPayer(payer: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.includes(payer);
}

export function rateOk(payer: string, perMin: number, now = Date.now()): boolean {
  const cutoff = now - 60_000;
  const prev = (windows.get(payer) ?? []).filter((t) => t > cutoff);
  if (prev.length >= perMin) {
    windows.set(payer, prev);
    return false;
  }
  prev.push(now);
  windows.set(payer, prev);
  return true;
}
