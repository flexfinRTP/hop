import { createReadStream, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const AGENT_DOCS: Record<string, { file: string; type: string }> = {
  "/llms.txt": { file: resolve(repo, "llms.txt"), type: "text/plain; charset=utf-8" },
  "/openapi.yaml": { file: resolve(repo, "openapi/openapi.yaml"), type: "text/yaml; charset=utf-8" },
  "/SKILL.md": { file: resolve(repo, "skills/hop-query/SKILL.md"), type: "text/markdown; charset=utf-8" },
  "/README.md": { file: resolve(repo, "README.md"), type: "text/markdown; charset=utf-8" },
};

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
      for (const [url, doc] of Object.entries(AGENT_DOCS)) {
        copyFileSync(doc.file, resolve(dist, url.slice(1)));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), agentDocs()],
  appType: "spa",
  optimizeDeps: {
    exclude: ["@hop/shared", "@hop/shared/ui"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
