import type { AssetTransaction, AtsStage } from "@hop/shared";
import type { AppConfig } from "./config.js";

type MirrorTransaction = {
  transaction_id?: string;
  consensus_timestamp?: string;
  result?: string;
};

type MirrorContractResult = {
  contract_id?: string;
  error_message?: string;
  created_contract_ids?: string[];
  logs?: { topics?: string[]; data?: string }[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTransactionId(ref: string): string {
  if (!ref.includes("@")) return ref;
  const [account, timestamp] = ref.split("@", 2);
  const [seconds, nanos] = (timestamp ?? "").split(".", 2);
  if (!account || !seconds || !nanos) throw new Error("invalid_transaction_id");
  return `${account}-${seconds}-${nanos}`;
}

async function mirrorJson<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) throw new Error("mirror_not_found");
  if (!response.ok) throw new Error(`mirror_http_${response.status}`);
  return (await response.json()) as T;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let delay = 400;
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("mirror_not_found") && !message.includes("transaction_not_found")) {
        throw error;
      }
      if (i === attempts - 1) break;
      await sleep(delay);
      delay = Math.min(delay * 2, 4_000);
    }
  }
  throw last instanceof Error ? last : new Error("mirror_retry_exhausted");
}

export async function verifyAtsAssetContract(
  cfg: AppConfig,
  assetContract: string,
): Promise<{ contractId?: string; evmAddress?: string; verified: boolean }> {
  const record = await withRetry(() =>
    mirrorJson<{
      contract_id?: string;
      evm_address?: string;
      deleted?: boolean;
    }>(
      cfg.atsMirrorNodeUrl,
      `/api/v1/contracts/${encodeURIComponent(assetContract)}`,
    ),
  );
  return {
    contractId: record.contract_id,
    evmAddress: record.evm_address,
    verified: !record.deleted && Boolean(record.contract_id || record.evm_address),
  };
}

export async function verifyAtsTransaction(
  cfg: AppConfig,
  stage: AtsStage,
  transactionId: string,
): Promise<AssetTransaction> {
  const normalized = normalizeTransactionId(transactionId);
  try {
    const [transactions, contract] = await Promise.all([
      withRetry(() =>
        mirrorJson<{ transactions?: MirrorTransaction[] }>(
          cfg.atsMirrorNodeUrl,
          `/api/v1/transactions/${encodeURIComponent(normalized)}`,
        ),
      ),
      withRetry(() =>
        mirrorJson<MirrorContractResult>(
          cfg.atsMirrorNodeUrl,
          `/api/v1/contracts/results/${encodeURIComponent(normalized)}`,
        ),
      ),
    ]);
    const tx = transactions.transactions?.[0];
    if (!tx) throw new Error("transaction_not_found");
    const created = contract.created_contract_ids ?? [];
    const logs = contract.logs ?? [];
    const factoryOk = stage !== "factory" || created.length > 0;
    const mutationOk =
      stage === "roles" ||
      stage === "compliance" ||
      logs.length > 0 ||
      created.length > 0 ||
      stage === "factory";
    const verified =
      tx.result === "SUCCESS" &&
      !(contract.error_message ?? "") &&
      factoryOk &&
      mutationOk;
    return {
      stage,
      transaction_id: tx.transaction_id ?? normalized,
      contract_id: contract.contract_id,
      consensus_timestamp: tx.consensus_timestamp,
      result: tx.result,
      verified,
      error: verified
        ? undefined
        : contract.error_message || tx.result || "transaction_failed",
    };
  } catch (error) {
    return {
      stage,
      transaction_id: normalized,
      verified: false,
      error: error instanceof Error ? error.message : "verification_failed",
    };
  }
}
