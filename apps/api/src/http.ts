const DEFAULT_MS = 20_000;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "url";
  }
}

function wrapFetchError(url: string, err: unknown): Error {
  const cause = err as { cause?: { code?: string; message?: string }; message?: string };
  const code = cause.cause?.code ?? "";
  const msg = cause.message ?? String(err);
  return new Error(`${hostOf(url)} ${code} ${msg}`.replace(/\s+/g, " ").trim());
}

export async function postJson(
  url: string,
  body: unknown,
  hdrs: Record<string, string> = {},
  timeoutMs = DEFAULT_MS,
): Promise<{ status: number; text: string }> {
  return postRaw(url, JSON.stringify(body), hdrs, timeoutMs);
}

export async function postRaw(
  url: string,
  body: string,
  hdrs: Record<string, string> = {},
  timeoutMs = DEFAULT_MS,
): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hdrs },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    throw wrapFetchError(url, err);
  }
}

export async function getJson<T>(url: string, timeoutMs = DEFAULT_MS): Promise<T> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    throw wrapFetchError(url, err);
  }
}
