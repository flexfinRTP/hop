#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { recipeSchema } from "./schema.js";
import { runRecipe } from "./runner.js";

function usage(): never {
  process.stderr.write(
    "Usage: hedera-lifecycle-harness <recipe.yaml|json> [--out evidence.json]\n",
  );
  process.exit(2);
}

function interpolate(raw: string): string {
  return raw.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_match, name: string) => {
    const value = process.env[name];
    if (value === undefined || value === "") throw new Error(`env_required:${name}`);
    return value;
  });
}

const args = process.argv.slice(2);
const recipePath = args[0];
if (!recipePath || recipePath.startsWith("-")) usage();
const outIndex = args.indexOf("--out");
const outputPath = outIndex >= 0 ? args[outIndex + 1] : undefined;
if (outIndex >= 0 && !outputPath) usage();

try {
  const raw = interpolate(await readFile(resolve(recipePath), "utf8"));
  const parsed = recipePath.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
  const recipe = recipeSchema.parse(parsed);
  const result = await runRecipe(recipe);
  const encoded = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(resolve(outputPath), encoded, "utf8");
  process.stdout.write(encoded);
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "harness_failed",
    })}\n`,
  );
  process.exitCode = 1;
}
