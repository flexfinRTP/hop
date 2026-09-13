import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetIntent } from "@hop/shared";
import { loadAssetIntents, persistAssetIntent } from "./database.js";

const intents = new Map<string, AssetIntent>();
let dir = "";

function remember(value: AssetIntent): void {
  if (!value.id || !value.evidence_id) return;
  intents.set(value.id, value);
}

export async function initAssetStore(evidenceDir: string): Promise<void> {
  dir = path.join(evidenceDir, "..", "assets");
  await mkdir(dir, { recursive: true });
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    if (!name.endsWith(".json")) continue;
    try {
      remember(JSON.parse(await readFile(path.join(dir, name), "utf8")) as AssetIntent);
    } catch {
      continue;
    }
  }
  for (const item of await loadAssetIntents()) {
    if (item && typeof item === "object") remember(item as AssetIntent);
  }
}

export function getAssetIntent(id: string): AssetIntent | undefined {
  return intents.get(id);
}

export function listAssetIntents(limit = 50): AssetIntent[] {
  return [...intents.values()]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

export async function putAssetIntent(intent: AssetIntent): Promise<void> {
  remember(intent);
  const file = path.join(dir, `${intent.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(intent), "utf8");
  try {
    await rename(tmp, file);
  } catch {
    await unlink(file).catch(() => undefined);
    await rename(tmp, file);
  }
  await persistAssetIntent({
    id: intent.id,
    evidenceId: intent.evidence_id,
    payload: intent,
    updatedAt: intent.updated_at,
  });
}
