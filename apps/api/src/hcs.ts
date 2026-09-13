import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./config.js";

let cachedTopic: string | undefined;

async function topicFile(cfg: AppConfig): Promise<string> {
  return path.join(cfg.evidenceDir, "..", "hcs-topic.txt");
}

async function resolveTopic(cfg: AppConfig): Promise<string | undefined> {
  if (cfg.hcsTopic) return cfg.hcsTopic;
  if (cachedTopic) return cachedTopic;
  const file = await topicFile(cfg);
  const existing = (await readFile(file, "utf8").catch(() => "")).trim();
  if (existing) {
    cachedTopic = existing;
    return existing;
  }
  if (!cfg.hcsAuto || !cfg.hederaOperatorId || !cfg.hederaOperatorKey) return undefined;

  const sdk = await import("@hashgraph/sdk");
  const client = sdk.Client.forTestnet();
  client.setOperator(
    sdk.AccountId.fromString(cfg.hederaOperatorId),
    sdk.PrivateKey.fromStringECDSA(cfg.hederaOperatorKey),
  );
  try {
    const tx = await new sdk.TopicCreateTransaction().setTopicMemo("hop-evidence").execute(client);
    const receipt = await tx.getReceipt(client);
    const id = receipt.topicId?.toString();
    if (!id) return undefined;
    cachedTopic = id;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, id, "utf8");
    return id;
  } finally {
    client.close();
  }
}

export async function hcsReady(cfg: AppConfig): Promise<{ topic?: string; auto: boolean }> {
  if (cfg.hcsTopic) return { topic: cfg.hcsTopic, auto: cfg.hcsAuto };
  if (!cfg.hcsAuto) return { auto: false };
  const file = await topicFile(cfg);
  const existing = (await readFile(file, "utf8").catch(() => "")).trim();
  return { topic: existing || cachedTopic, auto: true };
}

export async function submitReceiptHash(
  cfg: AppConfig,
  evidenceId: string,
  aggregateHash: string,
  settlementRef: string,
  extra?: {
    mandate_hash?: string;
    chain_hash?: string;
    policy_hash?: string;
    cre_commitment_hash?: string;
    world_hash?: string;
  },
): Promise<{ sequence: number; topic: string } | undefined> {
  return submitHcsJson(cfg, {
    type: "hop.receipt.v1",
    id: evidenceId,
    aggregate_hash: aggregateHash,
    settlement: settlementRef,
    mandate_hash: extra?.mandate_hash,
    chain_hash: extra?.chain_hash,
    policy_hash: extra?.policy_hash,
    cre_commitment_hash: extra?.cre_commitment_hash,
    world_hash: extra?.world_hash,
  });
}

export async function submitHcsJson(
  cfg: AppConfig,
  message: Record<string, unknown>,
): Promise<{ sequence: number; topic: string } | undefined> {
  if (!cfg.hederaOperatorId || !cfg.hederaOperatorKey) return undefined;
  const topic = await resolveTopic(cfg);
  if (!topic) return undefined;

  const sdk = await import("@hashgraph/sdk");
  const client = sdk.Client.forTestnet();
  client.setOperator(
    sdk.AccountId.fromString(cfg.hederaOperatorId),
    sdk.PrivateKey.fromStringECDSA(cfg.hederaOperatorKey),
  );
  try {
    const tx = await new sdk.TopicMessageSubmitTransaction()
      .setTopicId(topic)
      .setMessage(JSON.stringify(message))
      .execute(client);
    const receipt = await tx.getReceipt(client);
    const seq = receipt.topicSequenceNumber;
    return seq !== undefined ? { sequence: Number(seq), topic } : undefined;
  } finally {
    client.close();
  }
}
