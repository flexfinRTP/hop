import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTransactionId } from "../src/mirror.js";
import { recipeSchema } from "../src/schema.js";

test("normalizes Hedera SDK transaction ids for Mirror Node", () => {
  assert.equal(
    normalizeTransactionId("0.0.1234@1700000000.000000042"),
    "0.0.1234-1700000000-000000042",
  );
});

test("requires every ATS lifecycle stage", () => {
  const result = recipeSchema.safeParse({
    version: "1",
    name: "lifecycle",
    network: "hedera:testnet",
    steps: [{
      id: "ats",
      type: "ats_lifecycle",
      asset_contract: "0.0.123",
      transactions: [
        { stage: "factory", transaction: "a" },
        { stage: "roles", transaction: "b" },
        { stage: "compliance", transaction: "c" },
        { stage: "issue", transaction: "d" },
        { stage: "lifecycle", transaction: "e" },
      ],
    }],
  });
  assert.equal(result.success, true);
});
