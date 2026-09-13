import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";

const repo = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const documentationDir = path.join(repo, "documentation");

type AgentDoc = { file: string; type: string };

const AGENT_DOCS: Record<string, AgentDoc> = {
  "/llms.txt": { file: path.join(repo, "llms.txt"), type: "text/plain; charset=utf-8" },
  "/openapi.yaml": {
    file: path.join(repo, "openapi/openapi.yaml"),
    type: "text/yaml; charset=utf-8",
  },
  "/SKILL.md": {
    file: path.join(repo, "skills/hop-query/SKILL.md"),
    type: "text/markdown; charset=utf-8",
  },
  "/README.md": { file: path.join(repo, "README.md"), type: "text/markdown; charset=utf-8" },
  "/AI.md": { file: path.join(repo, "AI.md"), type: "text/markdown; charset=utf-8" },
  "/swagger.html": {
    file: path.join(repo, "apps/web/public/swagger.html"),
    type: "text/html; charset=utf-8",
  },
};

if (existsSync(documentationDir)) {
  const index = path.join(documentationDir, "README.md");
  AGENT_DOCS["/documentation"] = { file: index, type: "text/markdown; charset=utf-8" };
  AGENT_DOCS["/documentation/"] = { file: index, type: "text/markdown; charset=utf-8" };
  AGENT_DOCS["/documentation/README.md"] = { file: index, type: "text/markdown; charset=utf-8" };
  for (const name of readdirSync(documentationDir)) {
    if (!name.endsWith(".md")) continue;
    AGENT_DOCS[`/documentation/${name}`] = {
      file: path.join(documentationDir, name),
      type: "text/markdown; charset=utf-8",
    };
  }
}

export const AGENT_DOC_INDEX = {
  llms: "/llms.txt",
  openapi: "/openapi.yaml",
  skill: "/SKILL.md",
  documentation: "/documentation/README.md",
  judge: "/documentation/judge.md",
  swagger: "/swagger.html",
  agent_card: "/.well-known/agent-card.json",
  did: "/.well-known/did.json",
  oauth_protected_resource: "/.well-known/oauth-protected-resource",
} as const;

export function mountAgentDocs(app: Hono) {
  for (const [url, spec] of Object.entries(AGENT_DOCS)) {
    app.get(url, (c) => {
      if (!existsSync(spec.file)) return c.notFound();
      c.header("Content-Type", spec.type);
      c.header("Cache-Control", "no-cache");
      return c.body(readFileSync(spec.file, "utf8"));
    });
  }
}
