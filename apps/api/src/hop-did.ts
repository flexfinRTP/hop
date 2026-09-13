import { didWebFromOrigin, hopDidDocument, isDid, oauthProtectedResource } from "@hop/shared";
import type { AppConfig } from "./config.js";

export function hopDidFor(cfg: AppConfig, origin: string): string {
  if (cfg.hopDid && isDid(cfg.hopDid)) return cfg.hopDid;
  const base = (cfg.publicBaseUrl || origin).replace(/\/$/, "");
  return didWebFromOrigin(base);
}

export function hopDidJson(cfg: AppConfig, origin: string) {
  const base = (cfg.publicBaseUrl || origin).replace(/\/$/, "");
  return hopDidDocument({
    did: hopDidFor(cfg, origin),
    origin: base,
    mcpPublicUrl: cfg.mcpPublicUrl || undefined,
  });
}

export function hopOauthResource(origin: string) {
  const base = origin.replace(/\/$/, "");
  return oauthProtectedResource(base);
}
