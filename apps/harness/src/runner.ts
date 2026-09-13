import type { HarnessRecipe, HarnessStep } from "./schema.js";
import { MirrorClient } from "./mirror.js";

export type StepResult = {
  id: string;
  type: HarnessStep["type"];
  ok: boolean;
  checks: Record<string, boolean>;
  evidence: Record<string, unknown>;
  error?: string;
};

export type HarnessResult = {
  version: "1";
  recipe: string;
  network: "hedera:testnet";
  mirror_node_url: string;
  started_at: string;
  completed_at: string;
  ok: boolean;
  steps: StepResult[];
};

function amount(value: number | string | undefined): bigint {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}

function subset(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== "object") return Object.is(expected, actual);
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false;
    return expected.every((value, index) => subset(value, actual[index]));
  }
  if (!actual || typeof actual !== "object") return false;
  return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
    subset(value, (actual as Record<string, unknown>)[key]),
  );
}

function decodeMessage(encoded: string | undefined): unknown {
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

async function runTransaction(
  mirror: MirrorClient,
  step: Extract<HarnessStep, { type: "hedera_transaction" }>,
): Promise<StepResult> {
  const tx = await mirror.transaction(step.transaction);
  const checks: Record<string, boolean> = {
    result: tx.result === step.expect.result,
  };
  for (const expected of step.expect.transfers) {
    const transfers = expected.token ? tx.token_transfers ?? [] : tx.transfers ?? [];
    const found = transfers.some(
      (transfer) =>
        transfer.account === expected.account &&
        amount(transfer.amount) === BigInt(expected.amount) &&
        (!expected.token ||
          ("token_id" in transfer && transfer.token_id === expected.token)),
    );
    checks[`transfer:${expected.token ?? "HBAR"}:${expected.account}:${expected.amount}`] = found;
  }
  return {
    id: step.id,
    type: step.type,
    ok: Object.values(checks).every(Boolean),
    checks,
    evidence: {
      transaction_id: tx.transaction_id,
      consensus_timestamp: tx.consensus_timestamp,
      result: tx.result,
    },
  };
}

async function runContract(
  mirror: MirrorClient,
  step: Extract<HarnessStep, { type: "contract_result" }>,
): Promise<StepResult> {
  const [tx, result] = await Promise.all([
    mirror.transaction(step.transaction),
    mirror.contractResult(step.transaction),
  ]);
  const checks = {
    status: tx.result === step.expect.status,
    error_message: (result.error_message ?? "") === step.expect.error_message,
    contract: !step.expect.contract ||
      result.contract_id?.toLowerCase() === step.expect.contract.toLowerCase(),
  };
  return {
    id: step.id,
    type: step.type,
    ok: Object.values(checks).every(Boolean),
    checks,
    evidence: {
      transaction_id: tx.transaction_id,
      contract_id: result.contract_id,
      consensus_timestamp: result.consensus_timestamp ?? tx.consensus_timestamp,
      result: tx.result,
      error_message: result.error_message ?? "",
    },
  };
}

async function runHcs(
  mirror: MirrorClient,
  step: Extract<HarnessStep, { type: "hcs_message" }>,
): Promise<StepResult> {
  const message = await mirror.topicMessage(step.topic, step.sequence);
  const payload = decodeMessage(message.message);
  const checks = {
    topic: message.topic_id === step.topic,
    sequence: Number(message.sequence_number) === step.sequence,
    payload: subset(step.expect.json, payload),
  };
  return {
    id: step.id,
    type: step.type,
    ok: Object.values(checks).every(Boolean),
    checks,
    evidence: {
      topic_id: message.topic_id,
      sequence_number: message.sequence_number,
      consensus_timestamp: message.consensus_timestamp,
      payload,
    },
  };
}

async function runAtsLifecycle(
  mirror: MirrorClient,
  step: Extract<HarnessStep, { type: "ats_lifecycle" }>,
): Promise<StepResult> {
  const required = new Set(["factory", "roles", "compliance", "issue", "lifecycle"]);
  const seen = new Set(step.transactions.map((transaction) => transaction.stage));
  const uniqueTransactions = new Set(step.transactions.map((transaction) => transaction.transaction));
  const checks: Record<string, boolean> = {
    asset_contract_exists: false,
    required_stages: [...required].every((stage) => seen.has(stage as never)),
    unique_transactions: uniqueTransactions.size === step.transactions.length,
  };
  const asset = await mirror.contract(step.asset_contract);
  checks.asset_contract_exists = Boolean(asset.contract_id || asset.evm_address);

  const transactions: Record<string, unknown>[] = [];
  for (const item of step.transactions) {
    const [tx, contract] = await Promise.all([
      mirror.transaction(item.transaction),
      mirror.contractResult(item.transaction),
    ]);
    const created = contract.created_contract_ids ?? [];
    const logs = contract.logs ?? [];
    const success = tx.result === "SUCCESS" && !(contract.error_message ?? "");
    const factoryCreated = item.stage !== "factory" || created.length > 0 || !step.expect.created_from_factory;
    const hasLogs =
      !step.expect.require_logs ||
      item.stage === "factory" ||
      item.stage === "roles" ||
      item.stage === "compliance" ||
      logs.length > 0 ||
      created.length > 0;
    const ok = success && factoryCreated && hasLogs;
    checks[`stage:${item.stage}:${item.transaction}`] = ok;
    if (item.stage === "factory") checks.factory_created_contract = created.length > 0 || !step.expect.created_from_factory;
    transactions.push({
      stage: item.stage,
      transaction_id: tx.transaction_id,
      consensus_timestamp: tx.consensus_timestamp,
      contract_id: contract.contract_id,
      created_contract_ids: created,
      log_count: logs.length,
      result: tx.result,
      error_message: contract.error_message ?? "",
    });
  }
  return {
    id: step.id,
    type: step.type,
    ok: Object.values(checks).every(Boolean),
    checks,
    evidence: {
      asset_contract: step.asset_contract,
      asset,
      transactions,
    },
  };
}

async function runStep(mirror: MirrorClient, step: HarnessStep): Promise<StepResult> {
  try {
    switch (step.type) {
      case "hedera_transaction":
        return await runTransaction(mirror, step);
      case "contract_result":
        return await runContract(mirror, step);
      case "hcs_message":
        return await runHcs(mirror, step);
      case "ats_lifecycle":
        return await runAtsLifecycle(mirror, step);
    }
  } catch (error) {
    return {
      id: step.id,
      type: step.type,
      ok: false,
      checks: {},
      evidence: {},
      error: error instanceof Error ? error.message : "step_failed",
    };
  }
}

export async function runRecipe(recipe: HarnessRecipe): Promise<HarnessResult> {
  const started = new Date().toISOString();
  const mirror = new MirrorClient(recipe.mirror_node_url);
  const steps: StepResult[] = [];
  for (const step of recipe.steps) {
    steps.push(await runStep(mirror, step));
  }
  return {
    version: "1",
    recipe: recipe.name,
    network: recipe.network,
    mirror_node_url: recipe.mirror_node_url,
    started_at: started,
    completed_at: new Date().toISOString(),
    ok: steps.every((step) => step.ok),
    steps,
  };
}
