import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { LaunchFrame } from "./LaunchFrame";
import { ARTICLES, renderMarkdown } from "./md";
import { navigate } from "./nav";

const AGENT_FILES = [
  { n: "01", k: "llms.txt", v: "Routes, 402, query types", href: "/docs/llms", file: "/llms.txt" },
  { n: "02", k: "OpenAPI", v: "HTTP contract", href: "/docs/api", file: "/openapi.yaml" },
  { n: "03", k: "SKILL", v: "Hedera exact retry", href: "/docs/skill", file: "/SKILL.md" },
  { n: "04", k: "Agent Card", v: "A2A discovery", href: "/.well-known/agent-card.json", file: "/.well-known/agent-card.json" },
] as const;

const STEPS = [
  { n: "01", k: "Point the agent", v: "Give it llms.txt, OpenAPI, or SKILL." },
  { n: "02", k: "It maps the ask", v: "Fixed query type + protocol keys from /v1/meta." },
  { n: "03", k: "It pays Hedera", v: "HTTP 402 → exact x402 retry. No API key." },
  { n: "04", k: "It uses the result", v: "Decision stamp + public receipt." },
] as const;

const OPERATIONS = [
  { method: "POST", path: "/v1/query", v: "Paid decision. 402 then Hedera exact retry." },
  { method: "GET", path: "/v1/meta", v: "Protocol keys, meter, rails, agent file URLs." },
  { method: "GET", path: "/v1/evidence/{id}", v: "Public hashes. No policy values." },
  { method: "GET", path: "/v1/evidence/{id}/verify", v: "Hash, settlement, HCS, CRE tiers." },
  { method: "GET", path: "/v1/mandate", v: "Remaining budget. Does not pay." },
  { method: "GET", path: "/.well-known/agent-card.json", v: "A2A discovery card." },
] as const;

const MACHINE_PAGES: Record<string, { kicker: string; title: string; fetch: string; raw: string }> = {
  skill: {
    kicker: "AGENT SKILL",
    title: "Hedera exact retry.",
    fetch: "/SKILL.md",
    raw: "/SKILL.md",
  },
  llms: {
    kicker: "MACHINE MAP",
    title: "llms.txt",
    fetch: "/llms.txt",
    raw: "/llms.txt",
  },
};

function hop(path: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(path);
  };
}

function slugOf(): string {
  const path = window.location.pathname.replace(/\/$/, "") || "/docs";
  if (path === "/docs") return "";
  return path.replace(/^\/docs\//, "");
}

function CopyPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="docs-copy"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "COPIED" : "COPY URL"}
    </button>
  );
}

export function Docs() {
  const [slug, setSlug] = useState(slugOf);
  const [markdown, setMarkdown] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const article = ARTICLES.find((item) => item.slug === slug);
  const machine = MACHINE_PAGES[slug];
  const sourcePath = article
    ? `/documentation/${article.file}`
    : machine
      ? machine.fetch
      : "";

  useEffect(() => {
    const onPop = () => setSlug(slugOf());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!sourcePath) {
      setMarkdown("");
      setLoadState("idle");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    fetch(sourcePath)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text);
          setLoadState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  const html = useMemo(() => (markdown ? renderMarkdown(markdown) : ""), [markdown]);
  const groups = ["Start", "Rails", "Extra"] as const;

  return (
    <LaunchFrame page="docs">
      <main className="docs-main">
        <nav className="docs-side" aria-label="Docs">
          <p className="docs-side-label">POINT YOUR AGENT</p>
          <a className={!slug ? "active" : ""} href="/docs" onClick={hop("/docs")}>
            Integrate
          </a>
          <a className={slug === "skill" ? "active" : ""} href="/docs/skill" onClick={hop("/docs/skill")}>
            Skill
          </a>
          <a className={slug === "llms" ? "active" : ""} href="/docs/llms" onClick={hop("/docs/llms")}>
            llms.txt
          </a>
          <a className={slug === "api" ? "active" : ""} href="/docs/api" onClick={hop("/docs/api")}>
            HTTP + Swagger
          </a>
          {groups.map((group) => (
            <div key={group}>
              <p className="docs-side-label">{group.toUpperCase()}</p>
              {ARTICLES.filter((item) => item.group === group).map((item) => (
                <a
                  key={item.slug}
                  className={slug === item.slug ? "active" : ""}
                  href={`/docs/${item.slug}`}
                  onClick={hop(`/docs/${item.slug}`)}
                >
                  {item.k}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <section className="docs-body">
          {!slug ? (
            <>
              <p className="docs-kicker">AGENT INTEGRATION</p>
              <h1>Point your agent at these files.</h1>
              <p className="docs-lead">
                It pays Hedera exact x402 and uses the decision API in seconds. No SDK. No API
                key. No handwritten client.
              </p>
              <div className="docs-file-grid">
                {AGENT_FILES.map((file) => (
                  <article key={file.n}>
                    <span>{file.n}</span>
                    <div>
                      <a href={file.href} onClick={file.href.startsWith("/docs") ? hop(file.href) : undefined}>
                        <strong>{file.k}</strong>
                        <small>{file.v}</small>
                      </a>
                      <CopyPath path={file.file} />
                    </div>
                  </article>
                ))}
              </div>
              <div className="docs-steps">
                {STEPS.map((step) => (
                  <article key={step.n}>
                    <span>{step.n}</span>
                    <strong>{step.k}</strong>
                    <em>{step.v}</em>
                  </article>
                ))}
              </div>
              <div className="docs-cta-row">
                <a className="launch-button" href="/docs/skill" onClick={hop("/docs/skill")}>
                  READ AGENT SKILL <b>→</b>
                </a>
                <a className="launch-text-link" href="/docs/api" onClick={hop("/docs/api")}>
                  OPEN API + SWAGGER
                </a>
              </div>
            </>
          ) : null}

          {slug === "api" ? (
            <>
              <p className="docs-kicker">HTTP CONTRACT</p>
              <h1>OpenAPI + Swagger.</h1>
              <p className="docs-lead">
                Humans use this page. Agents fetch /openapi.yaml. Same contract.
              </p>
              <div className="docs-cta-row">
                <a className="launch-button" href="/openapi.yaml">
                  RAW OPENAPI.YAML <b>→</b>
                </a>
                <CopyPath path="/openapi.yaml" />
                <a className="launch-text-link" href="/swagger.html">
                  FULL SCREEN SWAGGER
                </a>
              </div>
              <div className="docs-ops">
                {OPERATIONS.map((op) => (
                  <article key={op.path}>
                    <b>{op.method}</b>
                    <strong>{op.path}</strong>
                    <span>{op.v}</span>
                  </article>
                ))}
              </div>
              <iframe
                className="docs-swagger"
                title="Hop Swagger UI"
                src="/swagger.html"
              />
            </>
          ) : null}

          {machine || article ? (
            <>
              <p className="docs-kicker">{machine?.kicker ?? article?.group.toUpperCase()}</p>
              <h1>{machine?.title ?? article?.k}</h1>
              <div className="docs-cta-row">
                <a className="launch-text-link" href={machine?.raw ?? `/documentation/${article?.file}`}>
                  RAW FILE
                </a>
                <CopyPath path={machine?.raw ?? `/documentation/${article?.file ?? ""}`} />
              </div>
              {loadState === "loading" ? <p className="docs-lead">Loading.</p> : null}
              {loadState === "error" ? (
                <p className="docs-lead">File not available. Use the raw file link.</p>
              ) : null}
              {html ? (
                <article
                  className="docs-md"
                  dangerouslySetInnerHTML={{ __html: html }}
                  onClick={(event) => {
                    const target = (event.target as HTMLElement).closest("a");
                    const href = target?.getAttribute("href");
                    if (!href || !href.startsWith("/docs")) return;
                    event.preventDefault();
                    navigate(href);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </LaunchFrame>
  );
}
