import type { AppConfig } from "./config.js";
import { submitReceiptHash } from "./hcs.js";
import {
  completeHcsOutbox,
  getById,
  put,
  takeHcsOutbox,
} from "./store.js";

type HcsOutboxPayload = {
  aggregateHash: string;
  settlementRef: string;
  extra?: {
    mandate_hash?: string;
    chain_hash?: string;
    policy_hash?: string;
    cre_commitment_hash?: string;
    world_hash?: string;
  };
};

let running = false;

export async function flushHcsOutbox(cfg: AppConfig): Promise<number> {
  if (running) return 0;
  running = true;
  let completed = 0;
  try {
    const rows = await takeHcsOutbox(10);
    for (const row of rows) {
      const payload = row.payload as HcsOutboxPayload;
      try {
        const anchor = await submitReceiptHash(
          cfg,
          row.evidenceId,
          payload.aggregateHash,
          payload.settlementRef,
          payload.extra,
        );
        if (!anchor) throw new Error("hcs_unconfigured");
        const evidence = getById(row.evidenceId);
        if (evidence) {
          evidence.json.hcs_seq = anchor.sequence;
          evidence.json.hcs_topic = anchor.topic;
          await put(evidence);
        }
        await completeHcsOutbox(row.evidenceId, true);
        completed += 1;
      } catch (error) {
        await completeHcsOutbox(
          row.evidenceId,
          false,
          error instanceof Error ? error.message : "hcs_submit_failed",
        );
      }
    }
  } finally {
    running = false;
  }
  return completed;
}

export function startHcsOutboxWorker(cfg: AppConfig): () => void {
  const intervalMs = Math.max(15_000, Number(process.env.HOP_HCS_OUTBOX_INTERVAL_MS ?? 60_000));
  const timer = setInterval(() => {
    void flushHcsOutbox(cfg);
  }, intervalMs);
  timer.unref();
  void flushHcsOutbox(cfg);
  return () => clearInterval(timer);
}
