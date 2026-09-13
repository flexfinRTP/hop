import type { Evidence, ExternalVerification } from "@hop/shared";
import type { AppConfig } from "./config.js";

type MirrorTransfer = {
  account?: string;
  amount?: number | string;
  token_id?: string;
};

type MirrorTransaction = {
  transaction_id?: string;
  consensus_timestamp?: string;
  result?: string;
  transfers?: MirrorTransfer[];
  token_transfers?: MirrorTransfer[];
};

type MirrorTransactions = {
  transactions?: MirrorTransaction[];
};

type MirrorTopicMessage = {
  consensus_timestamp?: string;
  message?: string;
  sequence_number?: number;
  topic_id?: string;
};

function normalizeTransactionId(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed.includes("@")) return trimmed;
  const [account, timestamp] = trimmed.split("@", 2);
  const [seconds, nanos] = (timestamp ?? "").split(".", 2);
  if (!account || !seconds || !nanos) return trimmed;
  return `${account}-${seconds}-${nanos}`;
}

function amountOf(transfer: MirrorTransfer): bigint {
  try {
    return BigInt(transfer.amount ?? 0);
  } catch {
    return 0n;
  }
}

async function mirrorJson<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`mirror_http_${response.status}`);
  return (await response.json()) as T;
}

function decodeMessage(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyEvidenceExternally(
  cfg: AppConfig,
  evidence: Evidence,
): Promise<ExternalVerification> {
  const checkedAt = new Date().toISOString();
  const transactionId = normalizeTransactionId(evidence.settlement.ref);
  const expectedAmount = BigInt(evidence.meter?.amount ?? "0");
  const base: ExternalVerification = {
    checked_at: checkedAt,
    mirror_node: cfg.mirrorNodeUrl,
    settlement: {
      verified: false,
      transaction_id: transactionId,
      payer_match: false,
      payee_match: false,
      amount_match: false,
    },
  };

  try {
    const transactionResponse = await mirrorJson<MirrorTransactions>(
      cfg.mirrorNodeUrl,
      `/api/v1/transactions/${encodeURIComponent(transactionId)}`,
    );
    const transaction = transactionResponse.transactions?.find(
      (item) => !item.transaction_id || item.transaction_id === transactionId,
    ) ?? transactionResponse.transactions?.[0];
    if (!transaction) throw new Error("mirror_transaction_missing");

    const hbar = cfg.asset === "0.0.0";
    const transfers = hbar ? transaction.transfers ?? [] : transaction.token_transfers ?? [];
    const assetTransfers = hbar
      ? transfers
      : transfers.filter((transfer) => transfer.token_id === cfg.asset);
    const payerTransfer = assetTransfers.find(
      (transfer) => transfer.account === evidence.payer_account && amountOf(transfer) < 0n,
    );
    const payeeTransfer = assetTransfers.find(
      (transfer) => transfer.account === cfg.payTo && amountOf(transfer) > 0n,
    );
    const paidAmount = payeeTransfer ? amountOf(payeeTransfer) : 0n;
    base.settlement = {
      verified:
        transaction.result === "SUCCESS" &&
        Boolean(payerTransfer) &&
        Boolean(payeeTransfer) &&
        paidAmount === expectedAmount,
      transaction_id: transaction.transaction_id ?? transactionId,
      consensus_timestamp: transaction.consensus_timestamp,
      result: transaction.result,
      payer_match: Boolean(payerTransfer),
      payee_match: Boolean(payeeTransfer),
      amount_match: paidAmount === expectedAmount,
    };

    const topic = evidence.hcs_topic ?? cfg.hcsTopic;
    if (topic && evidence.hcs_seq !== undefined) {
      const message = await mirrorJson<MirrorTopicMessage>(
        cfg.mirrorNodeUrl,
        `/api/v1/topics/${encodeURIComponent(topic)}/messages/${evidence.hcs_seq}`,
      );
      const payload = decodeMessage(message.message);
      const payloadMatch =
        payload?.id === evidence.id &&
        payload?.aggregate_hash === evidence.aggregate_hash &&
        payload?.settlement === evidence.settlement.ref;
      base.hcs = {
        verified:
          message.topic_id === topic &&
          Number(message.sequence_number) === evidence.hcs_seq &&
          payloadMatch,
        topic,
        sequence: evidence.hcs_seq,
        consensus_timestamp: message.consensus_timestamp,
        payload_match: payloadMatch,
      };
    }

    return base;
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "mirror_verification_failed",
    };
  }
}
