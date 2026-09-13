import { closeSync, copyFileSync, createReadStream, existsSync, mkdirSync, openSync, readSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "public");
const documentationDir = resolve(repo, "documentation");

function sniffImageType(file: string): string | null {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(16);
    readSync(fd, head, 0, 16, 0);
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
    if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
    if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return null;
  } finally {
    closeSync(fd);
  }
}

function brandImageMime(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const urlPath = req.url?.split("?")[0] ?? "";
    if (!urlPath.startsWith("/brand/") || !/\.(png|jpe?g|webp)$/i.test(urlPath)) return next();
    const file = resolve(publicDir, urlPath.replace(/^\//, ""));
    const rel = relative(publicDir, file);
    if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) return next();
    if (!existsSync(file)) return next();
    const type = sniffImageType(file);
    if (!type) return next();
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(file).pipe(res);
  };
  return {
    name: "hop-brand-image-mime",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

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
      const written = new Set<string>();
      for (const [url, doc] of Object.entries(AGENT_DOCS)) {
        let rel = url.replace(/^\//, "").replace(/\/$/, "");
        if (!rel || !/\.[A-Za-z0-9]+$/.test(rel)) rel = rel ? `${rel}/index.md` : "index.md";
        const dest = resolve(dist, rel);
        if (written.has(dest) || !existsSync(doc.file)) continue;
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(doc.file, dest);
        written.add(dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [brandImageMime(), react(), agentDocs()],
  appType: "spa",
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@hop/shared/ui": resolve(repo, "packages/shared/src/ui.ts"),
      "@hop/shared": resolve(repo, "packages/shared/src/index.ts"),
    },
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
