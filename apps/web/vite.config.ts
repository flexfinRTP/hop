import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const documentationDir = resolve(repo, "documentation");

const AGENT_DOCS: Record<string, { file: string; type: string }> = {
  "/llms.txt": { file: resolve(repo, "llms.txt"), type: "text/plain; charset=utf-8" },
  "/openapi.yaml": { file: resolve(repo, "openapi/openapi.yaml"), type: "text/yaml; charset=utf-8" },
  "/SKILL.md": { file: resolve(repo, "skills/hop-query/SKILL.md"), type: "text/markdown; charset=utf-8" },
  "/README.md": { file: resolve(repo, "README.md"), type: "text/markdown; charset=utf-8" },
  "/AI.md": { file: resolve(repo, "AI.md"), type: "text/markdown; charset=utf-8" },
};

if (existsSync(documentationDir)) {
  const index = resolve(documentationDir, "README.md");
  AGENT_DOCS["/documentation"] = { file: index, type: "text/markdown; charset=utf-8" };
  AGENT_DOCS["/documentation/"] = { file: index, type: "text/markdown; charset=utf-8" };
  AGENT_DOCS["/documentation/README.md"] = { file: index, type: "text/markdown; charset=utf-8" };
  for (const name of readdirSync(documentationDir)) {
    if (!name.endsWith(".md")) continue;
    AGENT_DOCS[`/documentation/${name}`] = {
      file: resolve(documentationDir, name),
      type: "text/markdown; charset=utf-8",
    };
  }
}

function docsMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split("?")[0] ?? "";
    const doc = AGENT_DOCS[path];
    if (!doc || !existsSync(doc.file)) return next();
    res.setHeader("Content-Type", doc.type);
    createReadStream(doc.file).pipe(res);
  };
}

function agentDocs(): Plugin {
  return {
    name: "hop-agent-docs",
    configureServer(server) {
      server.middlewares.use(docsMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(docsMiddleware());
    },
    closeBundle() {
      const dist = resolve(dirname(fileURLToPath(import.meta.url)), "dist");
      mkdirSync(resolve(dist, "documentation"), { recursive: true });
      for (const [url, doc] of Object.entries(AGENT_DOCS)) {
        const dest = resolve(dist, url.replace(/^\//, "").replace(/\/$/, "/index.md"));
        mkdirSync(dirname(dest), { recursive: true });
        if (existsSync(doc.file)) copyFileSync(doc.file, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), agentDocs()],
  appType: "spa",
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    exclude: ["@hop/shared", "@hop/shared/ui"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/health": "http://localhost:8787",
      "/.well-known": "http://localhost:8787",
    },
  },
});
