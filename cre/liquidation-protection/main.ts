import {
  CronCapability,
  HTTPClient,
  Runner,
  handlerInTee,
  type TeeRuntime,
  type Workflow,
} from "@chainlink/cre-sdk";
import {
  decodeFunctionResult,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  canonicalJson,
  hashJson,
  keyedHashJson,
} from "../../packages/shared/src/index.ts";

type SecretIds = {
  rpc_url: string;
  private_key: string;
  min_hf_trigger: string;
  target_hf: string;
  max_repay_pct: string;
  max_deposit_units: string;
  action_priority: string;
  safety_margin: string;
  cooldown_seconds: string;
  emergency_hf: string;
  commitment_salt: string;
};

export type Config = {
  schedule: string;
  chain_id: number;
  lending_address: Address;
  veth_address: Address;
  vusd_address: Address;
  secrets_ids: SecretIds;
};

type Position = {
  collateral: bigint;
  debt: bigint;
  hf: bigint;
  numOperations: bigint;
  lastUpdateTime: bigint;
  cumulativeDebtTime: bigint;
};

type PrivatePolicy = {
  minHfTrigger: bigint;
  targetHf: bigint;
  maxRepayPct: bigint;
  maxDepositUnits: bigint;
  actionPriority: "deposit-first" | "repay-first";
  safetyMargin: bigint;
  cooldownSeconds: bigint;
  emergencyHf: bigint;
};

type ActionPlan = {
  repay: bigint;
  deposit: bigint;
  projectedHf: bigint;
  emergency: boolean;
};

const POSITION_ABI = [{
  name: "getUserPosition",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "user", type: "address" }],
  outputs: [{
    type: "tuple",
    components: [
      { name: "collateral", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "hf", type: "uint256" },
      { name: "numOperations", type: "uint256" },
      { name: "lastUpdateTime", type: "uint256" },
      { name: "cumulativeDebtTime", type: "uint256" },
    ],
  }],
}] as const;

const LENDING_READ_ABI = [
  {
    name: "vETHPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "isUser",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "scenarioStartTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const TOKEN_READ_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const APPROVE_ABI = [{
  name: "approve",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ type: "bool" }],
}] as const;

const REPAY_ABI = [{
  name: "repay",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "amount", type: "uint256" }],
  outputs: [],
}] as const;

const DEPOSIT_ABI = [{
  name: "deposit",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "amount", type: "uint256" }],
  outputs: [],
}] as const;

const LIQUIDATION_THRESHOLD = 78n;
const MAX_UINT256 = (1n << 256n) - 1n;
const NITRO_US_WEST_2: [{ tee: "nitro"; regions: ["us-west-2"] }] = [
  { tee: "nitro", regions: ["us-west-2"] },
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseHex(value: unknown): bigint {
  const text = asString(value);
  if (!/^0x[0-9a-f]+$/i.test(text)) throw new Error("rpc_hex_invalid");
  return BigInt(text);
}

function parseJson(raw: string): Record<string, unknown> {
  const value = JSON.parse(raw) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("rpc_json_invalid");
  }
  return value as Record<string, unknown>;
}

function rpc(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  method: string,
  params: unknown[],
): Record<string, unknown> {
  const response = client
    .sendRequest(runtime, {
      url,
      method: "POST",
      timeout: "15s",
      body: Buffer.from(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      })).toString("base64"),
      headers: { "Content-Type": "application/json" },
    })
    .result();
  const raw = new TextDecoder().decode(response.body);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`rpc_http_${response.statusCode}`);
  }
  const decoded = parseJson(raw);
  if (decoded.error) throw new Error("rpc_response_error");
  return decoded;
}

function ethCall(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  to: Address,
  data: Hex,
): Hex {
  return asString(
    rpc(runtime, client, url, "eth_call", [{ to, data }, "latest"]).result,
  ) as Hex;
}

function readFunction<T>(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = [],
): T {
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  } as never);
  const result = ethCall(runtime, client, url, address, data);
  return decodeFunctionResult({
    abi,
    functionName,
    data: result,
  } as never) as T;
}

function min(...values: bigint[]): bigint {
  return values.reduce((current, value) => value < current ? value : current);
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("division_invalid");
  return (numerator + denominator - 1n) / denominator;
}

function healthFactor(collateral: bigint, debt: bigint, price: bigint): bigint {
  if (debt === 0n) return 10_000n;
  return collateral * price * LIQUIDATION_THRESHOLD / (100n * debt);
}

function requiredDeposit(position: Position, price: bigint, targetHf: bigint): bigint {
  const needed = ceilDiv(
    targetHf * 100n * position.debt,
    price * LIQUIDATION_THRESHOLD,
  );
  return needed > position.collateral ? needed - position.collateral : 0n;
}

function requiredRepay(
  collateral: bigint,
  debt: bigint,
  price: bigint,
  targetHf: bigint,
): bigint {
  const targetDebt = collateral * price * LIQUIDATION_THRESHOLD / (100n * targetHf);
  return debt > targetDebt ? debt - targetDebt : 0n;
}

function planActions(
  position: Position,
  price: bigint,
  vusdBalance: bigint,
  vethBalance: bigint,
  policy: PrivatePolicy,
): ActionPlan {
  const target = policy.targetHf + policy.safetyMargin;
  const emergency = position.hf <= policy.emergencyHf;
  const repayCap = emergency
    ? position.debt
    : position.debt * policy.maxRepayPct / 100n;
  let repay = 0n;
  let deposit = 0n;

  if (policy.actionPriority === "deposit-first") {
    deposit = min(requiredDeposit(position, price, target), policy.maxDepositUnits, vethBalance);
    repay = min(
      requiredRepay(position.collateral + deposit, position.debt, price, target),
      repayCap,
      vusdBalance,
    );
  } else {
    repay = min(
      requiredRepay(position.collateral, position.debt, price, target),
      repayCap,
      vusdBalance,
    );
    const afterRepay: Position = { ...position, debt: position.debt - repay };
    deposit = min(requiredDeposit(afterRepay, price, target), policy.maxDepositUnits, vethBalance);
  }
  return {
    repay,
    deposit,
    projectedHf: healthFactor(position.collateral + deposit, position.debt - repay, price),
    emergency,
  };
}

function boundedSecret(
  secrets: Record<string, { value: string }>,
  id: string,
  minValue: bigint,
  maxValue: bigint,
): bigint {
  const value = BigInt(secrets[id]?.value ?? "");
  if (value < minValue || value > maxValue) throw new Error("policy_secret_out_of_range");
  return value;
}

function readPolicy(
  runtime: TeeRuntime<Config>,
): {
  rpcUrl: string;
  privateKey: Hex;
  commitmentSalt: string;
  policy: PrivatePolicy;
} {
  const ids = runtime.config.secrets_ids;
  const requested = Object.values(ids).map((id) => ({ id }));
  const secrets = runtime.getSecrets(requested).result() as Record<string, { value: string }>;
  const rpcUrl = secrets[ids.rpc_url]?.value?.trim() ?? "";
  const privateKey = secrets[ids.private_key]?.value?.trim() ?? "";
  const commitmentSalt = secrets[ids.commitment_salt]?.value?.trim() ?? "";
  if (!/^https:\/\//.test(rpcUrl)) throw new Error("rpc_secret_invalid");
  if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) throw new Error("private_key_secret_invalid");
  if (commitmentSalt.length < 32) throw new Error("commitment_salt_invalid");
  const priority = secrets[ids.action_priority]?.value;
  if (priority !== "deposit-first" && priority !== "repay-first") {
    throw new Error("action_priority_invalid");
  }
  const policy: PrivatePolicy = {
    minHfTrigger: boundedSecret(secrets, ids.min_hf_trigger, 100n, 300n),
    targetHf: boundedSecret(secrets, ids.target_hf, 101n, 400n),
    maxRepayPct: boundedSecret(secrets, ids.max_repay_pct, 0n, 100n),
    maxDepositUnits: boundedSecret(secrets, ids.max_deposit_units, 0n, 500n),
    actionPriority: priority,
    safetyMargin: boundedSecret(secrets, ids.safety_margin, 0n, 100n),
    cooldownSeconds: boundedSecret(secrets, ids.cooldown_seconds, 0n, 3600n),
    emergencyHf: boundedSecret(secrets, ids.emergency_hf, 0n, 150n),
  };
  if (
    policy.targetHf <= policy.minHfTrigger ||
    policy.emergencyHf > policy.minHfTrigger
  ) {
    throw new Error("policy_relationship_invalid");
  }
  return {
    rpcUrl,
    privateKey: privateKey as Hex,
    commitmentSalt,
    policy,
  };
}

function nextNonce(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  account: Address,
): number {
  return Number(parseHex(
    rpc(runtime, client, url, "eth_getTransactionCount", [account, "pending"]).result,
  ));
}

function gasPrice(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
): bigint {
  return parseHex(rpc(runtime, client, url, "eth_gasPrice", []).result);
}

function estimateGas(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  from: Address,
  to: Address,
  data: Hex,
): bigint {
  const estimate = parseHex(
    rpc(runtime, client, url, "eth_estimateGas", [{ from, to, data }]).result,
  );
  return estimate * 125n / 100n;
}

async function send(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  account: ReturnType<typeof privateKeyToAccount>,
  to: Address,
  data: Hex,
  nonce: number,
  price: bigint,
): Promise<string> {
  const signed = await account.signTransaction({
    chainId: runtime.config.chain_id,
    to,
    data,
    gas: estimateGas(runtime, client, url, account.address, to, data),
    gasPrice: price,
    nonce,
    value: 0n,
  });
  return asString(
    rpc(runtime, client, url, "eth_sendRawTransaction", [signed]).result,
  );
}

function allowance(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  token: Address,
  owner: Address,
  spender: Address,
): bigint {
  return readFunction<bigint>(
    runtime,
    client,
    url,
    token,
    TOKEN_READ_ABI,
    "allowance",
    [owner, spender],
  );
}

async function approveIfNeeded(
  runtime: TeeRuntime<Config>,
  client: HTTPClient,
  url: string,
  account: ReturnType<typeof privateKeyToAccount>,
  token: Address,
  spender: Address,
  amount: bigint,
  nonce: number,
  price: bigint,
): Promise<{ nonce: number; hash?: string }> {
  if (allowance(runtime, client, url, token, account.address, spender) >= amount) {
    return { nonce };
  }
  const data = encodeFunctionData({
    abi: APPROVE_ABI,
    functionName: "approve",
    args: [spender, MAX_UINT256],
  });
  return {
    nonce: nonce + 1,
    hash: await send(runtime, client, url, account, token, data, nonce, price),
  };
}

function report(
  runtime: TeeRuntime<Config>,
  commitment: Record<string, unknown>,
): string {
  const encodedPayload = Buffer.from(canonicalJson(commitment)).toString("base64");
  runtime.usingTheDons().report({
    encodedPayload,
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result();
  return hashJson(commitment);
}

export const onCronTrigger = async (
  runtime: TeeRuntime<Config>,
): Promise<string> => {
  const { rpcUrl, privateKey, commitmentSalt, policy } = readPolicy(runtime);
  const account = privateKeyToAccount(privateKey);
  const client = new HTTPClient();
  const { lending_address: lending, veth_address: veth, vusd_address: vusd } =
    runtime.config;

  const joined = readFunction<boolean>(
    runtime,
    client,
    rpcUrl,
    lending,
    LENDING_READ_ABI,
    "isUser",
    [account.address],
  );
  if (!joined) return JSON.stringify({ status: "NOT_JOINED" });
  const scenarioStart = readFunction<bigint>(
    runtime,
    client,
    rpcUrl,
    lending,
    LENDING_READ_ABI,
    "scenarioStartTime",
  );
  if (scenarioStart === 0n) return JSON.stringify({ status: "WAITING" });

  const position = readFunction<Position>(
    runtime,
    client,
    rpcUrl,
    lending,
    POSITION_ABI,
    "getUserPosition",
    [account.address],
  );
  const price = readFunction<bigint>(
    runtime,
    client,
    rpcUrl,
    lending,
    LENDING_READ_ABI,
    "vETHPrice",
  );
  if (position.debt === 0n) return JSON.stringify({ status: "CLOSED" });
  if (position.hf > policy.minHfTrigger) return JSON.stringify({ status: "SAFE" });

  const latest = rpc(runtime, client, rpcUrl, "eth_getBlockByNumber", ["latest", false])
    .result as Record<string, unknown>;
  const now = parseHex(latest?.timestamp);
  if (
    position.hf > policy.emergencyHf &&
    position.lastUpdateTime > 0n &&
    now - position.lastUpdateTime < policy.cooldownSeconds
  ) {
    return JSON.stringify({ status: "COOLDOWN" });
  }

  const vethBalance = readFunction<bigint>(
    runtime,
    client,
    rpcUrl,
    veth,
    TOKEN_READ_ABI,
    "balanceOf",
    [account.address],
  );
  const vusdBalance = readFunction<bigint>(
    runtime,
    client,
    rpcUrl,
    vusd,
    TOKEN_READ_ABI,
    "balanceOf",
    [account.address],
  );
  const action = planActions(position, price, vusdBalance, vethBalance, policy);
  if (action.repay === 0n && action.deposit === 0n) {
    return JSON.stringify({ status: "NO_RESERVE" });
  }

  let nonce = nextNonce(runtime, client, rpcUrl, account.address);
  const pricePerGas = gasPrice(runtime, client, rpcUrl);
  const transactionHashes: string[] = [];

  const executeRepay = async () => {
    if (action.repay === 0n) return;
    const approved = await approveIfNeeded(
      runtime,
      client,
      rpcUrl,
      account,
      vusd,
      lending,
      action.repay,
      nonce,
      pricePerGas,
    );
    if (approved.hash) transactionHashes.push(approved.hash);
    nonce = approved.nonce;
    const data = encodeFunctionData({
      abi: REPAY_ABI,
      functionName: "repay",
      args: [action.repay],
    });
    transactionHashes.push(
      await send(runtime, client, rpcUrl, account, lending, data, nonce, pricePerGas),
    );
    nonce += 1;
  };

  const executeDeposit = async () => {
    if (action.deposit === 0n) return;
    const approved = await approveIfNeeded(
      runtime,
      client,
      rpcUrl,
      account,
      veth,
      lending,
      action.deposit,
      nonce,
      pricePerGas,
    );
    if (approved.hash) transactionHashes.push(approved.hash);
    nonce = approved.nonce;
    const data = encodeFunctionData({
      abi: DEPOSIT_ABI,
      functionName: "deposit",
      args: [action.deposit],
    });
    transactionHashes.push(
      await send(runtime, client, rpcUrl, account, lending, data, nonce, pricePerGas),
    );
    nonce += 1;
  };

  if (policy.actionPriority === "deposit-first") {
    await executeDeposit();
    await executeRepay();
  } else {
    await executeRepay();
    await executeDeposit();
  }

  const publicCommitment = {
    domain: "hop-liquidation-protection-v1",
    participant: account.address,
    pre_state_hash: hashJson({
      collateral: position.collateral.toString(),
      debt: position.debt.toString(),
      hf: position.hf.toString(),
      price: price.toString(),
    }),
    policy_commitment: keyedHashJson(commitmentSalt, {
      minHfTrigger: policy.minHfTrigger.toString(),
      targetHf: policy.targetHf.toString(),
      maxRepayPct: policy.maxRepayPct.toString(),
      maxDepositUnits: policy.maxDepositUnits.toString(),
      actionPriority: policy.actionPriority,
      safetyMargin: policy.safetyMargin.toString(),
      cooldownSeconds: policy.cooldownSeconds.toString(),
      emergencyHf: policy.emergencyHf.toString(),
    }),
    projected_hf: action.projectedHf.toString(),
    transaction_hashes: transactionHashes,
  };
  return JSON.stringify({
    status: "DEFENDED",
    commitment_hash: report(runtime, publicCommitment),
    transaction_hashes: transactionHashes,
  });
};

export const initWorkflow = (config: Config): Workflow => {
  if (
    !config.schedule ||
    config.chain_id !== 11155111 ||
    !/^0x[0-9a-f]{40}$/i.test(config.lending_address) ||
    !/^0x[0-9a-f]{40}$/i.test(config.veth_address) ||
    !/^0x[0-9a-f]{40}$/i.test(config.vusd_address) ||
    Object.keys(config.secrets_ids ?? {}).length !== 11
  ) {
    throw new Error("liquidation_config_invalid");
  }
  const cron = new CronCapability();
  return [
    handlerInTee(
      cron.trigger({ schedule: config.schedule }),
      onCronTrigger,
      {},
      NITRO_US_WEST_2,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
