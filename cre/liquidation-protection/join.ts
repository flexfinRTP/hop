import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const CHALLENGE = "0x88574e7Cc0027afd04951daa09B64d4441931ba1" as Address;
const ABI = [
  {
    name: "challengeOpen",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isUser",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "join",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

const rpcUrl = (process.env.LIQUIDATION_RPC_URL ?? "").trim();
const key = (process.env.LIQUIDATION_EXECUTOR_PRIVATE_KEY ?? "").trim() as Hex;
if (!/^https:\/\//.test(rpcUrl) || !/^0x[0-9a-f]{64}$/i.test(key)) {
  throw new Error("LIQUIDATION_RPC_URL and LIQUIDATION_EXECUTOR_PRIVATE_KEY are required");
}

const account = privateKeyToAccount(key);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ account, chain: sepolia, transport });
const [open, joined] = await Promise.all([
  publicClient.readContract({
    address: CHALLENGE,
    abi: ABI,
    functionName: "challengeOpen",
  }),
  publicClient.readContract({
    address: CHALLENGE,
    abi: ABI,
    functionName: "isUser",
    args: [account.address],
  }),
]);
if (joined) {
  process.stdout.write(`${JSON.stringify({ joined: true, account: account.address })}\n`);
  process.exit(0);
}
if (!open) throw new Error("challenge_registration_closed");

const hash = await walletClient.writeContract({
  address: CHALLENGE,
  abi: ABI,
  functionName: "join",
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error("join_transaction_reverted");
const verified = await publicClient.readContract({
  address: CHALLENGE,
  abi: ABI,
  functionName: "isUser",
  args: [account.address],
});
if (!verified) throw new Error("join_not_confirmed");
process.stdout.write(
  `${JSON.stringify({
    joined: true,
    account: account.address,
    transaction_hash: hash,
    block_number: receipt.blockNumber.toString(),
  })}\n`,
);
