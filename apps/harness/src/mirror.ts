export type TransactionRecord = {
  transaction_id?: string;
  consensus_timestamp?: string;
  result?: string;
  transfers?: { account?: string; amount?: number | string }[];
  token_transfers?: {
    token_id?: string;
    account?: string;
    amount?: number | string;
  }[];
};

export type ContractResult = {
  transaction_id?: string;
  contract_id?: string;
  result?: string;
  error_message?: string;
  consensus_timestamp?: string;
  created_contract_ids?: string[];
  logs?: { topics?: string[]; data?: string }[];
};

export type TopicMessage = {
  topic_id?: string;
  sequence_number?: number;
  consensus_timestamp?: string;
  message?: string;
};

export function normalizeTransactionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("@")) return trimmed;
  const [account, timestamp] = trimmed.split("@", 2);
  const [seconds, nanos] = (timestamp ?? "").split(".", 2);
  if (!account || !seconds || !nanos) throw new Error("invalid_transaction_id");
  return `${account}-${seconds}-${nanos}`;
}

export class MirrorClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async get<T>(path: string): Promise<T> {
    let delay = 400;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status !== 404 || attempt === 7) {
        throw new Error(`mirror_http_${response.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 4_000);
    }
    throw new Error("mirror_http_404");
  }

  async transaction(id: string): Promise<TransactionRecord> {
    const normalized = normalizeTransactionId(id);
    const response = await this.get<{ transactions?: TransactionRecord[] }>(
      `/api/v1/transactions/${encodeURIComponent(normalized)}`,
    );
    const transaction = response.transactions?.[0];
    if (!transaction) throw new Error("transaction_not_found");
    return transaction;
  }

  async contractResult(id: string): Promise<ContractResult> {
    const normalized = normalizeTransactionId(id);
    return this.get<ContractResult>(
      `/api/v1/contracts/results/${encodeURIComponent(normalized)}`,
    );
  }

  async contract(id: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(
      `/api/v1/contracts/${encodeURIComponent(id)}`,
    );
  }

  async topicMessage(topic: string, sequence: number): Promise<TopicMessage> {
    return this.get<TopicMessage>(
      `/api/v1/topics/${encodeURIComponent(topic)}/messages/${sequence}`,
    );
  }
}
