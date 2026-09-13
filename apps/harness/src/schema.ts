import { z } from "zod";

const accountAmount = z.object({
  account: z.string().regex(/^0\.0\.\d+$/),
  amount: z.string().regex(/^-?\d+$/),
  token: z.string().regex(/^0\.0\.\d+$/).optional(),
});

const transactionStep = z.object({
  id: z.string().min(1),
  type: z.literal("hedera_transaction"),
  transaction: z.string().min(1),
  expect: z.object({
    result: z.string().default("SUCCESS"),
    transfers: z.array(accountAmount).default([]),
  }),
});

const hcsStep = z.object({
  id: z.string().min(1),
  type: z.literal("hcs_message"),
  topic: z.string().regex(/^0\.0\.\d+$/),
  sequence: z.number().int().positive(),
  expect: z.object({
    json: z.record(z.unknown()),
  }),
});

const contractStep = z.object({
  id: z.string().min(1),
  type: z.literal("contract_result"),
  transaction: z.string().min(1),
  expect: z.object({
    contract: z.string().min(1).optional(),
    status: z.string().default("SUCCESS"),
    error_message: z.string().default(""),
  }),
});

const atsStage = z.enum([
  "factory",
  "roles",
  "compliance",
  "issue",
  "lifecycle",
  "kyc",
  "coupon",
  "redeem",
  "pause",
  "unpause",
  "freeze",
]);

const atsLifecycleStep = z.object({
  id: z.string().min(1),
  type: z.literal("ats_lifecycle"),
  asset_contract: z.string().min(1),
  transactions: z
    .array(z.object({ stage: atsStage, transaction: z.string().min(1) }))
    .min(5),
  expect: z.object({
    created_from_factory: z.boolean().default(true),
    require_logs: z.boolean().default(true),
  }).default({
    created_from_factory: true,
    require_logs: true,
  }),
});

export const recipeSchema = z.object({
  version: z.literal("1"),
  name: z.string().min(1),
  network: z.literal("hedera:testnet"),
  mirror_node_url: z.string().url().default("https://testnet.mirrornode.hedera.com"),
  steps: z
    .array(
      z.discriminatedUnion("type", [
        transactionStep,
        hcsStep,
        contractStep,
        atsLifecycleStep,
      ]),
    )
    .min(1),
}).superRefine((recipe, context) => {
  const required = ["factory", "roles", "compliance", "issue", "lifecycle"] as const;
  recipe.steps.forEach((step, index) => {
    if (step.type !== "ats_lifecycle") return;
    const stages = new Set(step.transactions.map((transaction) => transaction.stage));
    for (const stage of required) {
      if (!stages.has(stage)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "transactions"],
          message: `ATS lifecycle requires ${stage}`,
        });
      }
    }
  });
});

export type HarnessRecipe = z.infer<typeof recipeSchema>;
export type HarnessStep = HarnessRecipe["steps"][number];
