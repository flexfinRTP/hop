import { Hono } from "hono";
import {
  decodeFunctionResult,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { loadConfig } from "../config.js";
import { postJson } from "../http.js";

const CHALLENGE = "0x88574e7Cc0027afd04951daa09B64d4441931ba1" as Address;
const VETH = "0x5dED1a40c3D56dA42E7f932f781c0432556c9814" as Address;
const VUSD = "0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2" as Address;

const CHALLENGE_ABI = [
  {
    name: "challengeOpen",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "scenarioStartTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "scenarioEndTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
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
    name: "loanContinuityScore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
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
  },
] as const;

const TOKEN_ABI = [{
  name: "balanceOf",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ type: "uint256" }],
}] as const;

async function call<T>(
  rpcUrl: string,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const response = await postJson(
    rpcUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: address, data }, "latest"],
    },
    {},
    12_000,
  );
  if (response.status !== 200) throw new Error(`rpc_http_${response.status}`);
  const decoded = JSON.parse(response.text) as { result?: Hex; error?: unknown };
  if (!decoded.result || decoded.error) throw new Error("rpc_call_failed");
  return decodeFunctionResult({
    abi,
    functionName,
    data: decoded.result,
  } as never) as T;
}

export const liquidation = new Hono();

liquidation.get("/", async (c) => {
  const cfg = loadConfig();
  const participant = cfg.liquidationParticipant as Address;
  const configured = /^0x[a-fA-F0-9]{40}$/.test(participant);
  const contracts = {
    challenge: CHALLENGE,
    veth: VETH,
    vusd: VUSD,
    explorer: "https://sepolia.etherscan.io",
  };
  if (!configured) {
    return c.json({
      configured: false,
      chain_id: 11155111,
      participant: null,
      workflow_id: cfg.liquidationWorkflowId || null,
      contracts,
    });
  }

  try {
    const [
      challengeOpen,
      scenarioStart,
      scenarioEnd,
      price,
      joined,
      score,
      position,
      vethBalance,
      vusdBalance,
    ] = await Promise.all([
      call<boolean>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "challengeOpen"),
      call<bigint>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "scenarioStartTime"),
      call<bigint>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "scenarioEndTime"),
      call<bigint>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "vETHPrice"),
      call<boolean>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "isUser", [participant]),
      call<bigint>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "loanContinuityScore", [participant]),
      call<{
        collateral: bigint;
        debt: bigint;
        hf: bigint;
        numOperations: bigint;
        lastUpdateTime: bigint;
        cumulativeDebtTime: bigint;
      }>(cfg.liquidationRpcUrl, CHALLENGE, CHALLENGE_ABI, "getUserPosition", [participant]),
      call<bigint>(cfg.liquidationRpcUrl, VETH, TOKEN_ABI, "balanceOf", [participant]),
      call<bigint>(cfg.liquidationRpcUrl, VUSD, TOKEN_ABI, "balanceOf", [participant]),
    ]);
    const liveHf = position.debt === 0n
      ? null
      : position.collateral * price * 78n / (100n * position.debt);
    return c.json({
      configured: true,
      chain_id: 11155111,
      participant,
      workflow_id: cfg.liquidationWorkflowId || null,
      contracts,
      challenge_open: challengeOpen,
      joined,
      scenario: {
        state: scenarioEnd > 0n ? "stopped" : scenarioStart > 0n ? "active" : "waiting",
        started_at: scenarioStart.toString(),
        ended_at: scenarioEnd.toString(),
      },
      position: {
        collateral_veth_units: position.collateral.toString(),
        debt_vusd_units: position.debt.toString(),
        stored_health_factor_x100: position.hf.toString(),
        live_health_factor_x100: liveHf?.toString() ?? null,
        operations: position.numOperations.toString(),
        last_update_time: position.lastUpdateTime.toString(),
        cumulative_debt_time: position.cumulativeDebtTime.toString(),
      },
      reserves: {
        veth_units: vethBalance.toString(),
        vusd_units: vusdBalance.toString(),
      },
      veth_price_vusd_units: price.toString(),
      loan_continuity_score_bps: score.toString(),
    });
  } catch (error) {
    return c.json({
      configured: true,
      error: "liquidation_rpc_unavailable",
      detail: error instanceof Error ? error.message : "rpc_error",
      participant,
      contracts,
    }, 503);
  }
});
