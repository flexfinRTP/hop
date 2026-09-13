import type { MouseEvent } from "react";
import { LaunchFrame } from "./LaunchFrame";
import { navigate } from "./nav";
import { RailLogo } from "./RailLogo";

const STACK = [
  {
    index: "01",
    rail: "THE GRAPH",
    role: "PUBLIC DATA",
    title: "Standardized lending",
    detail: "Aave v3 + Compound v3 · Messari 3.1.0",
    logo: "graph" as const,
  },
  {
    index: "02",
    rail: "CHAINLINK CRE",
    role: "PRIVATE COMPUTE",
    title: "Confidential policy join",
    detail: "handlerInTee · Nitro · simulation",
    logo: "chainlink" as const,
  },
  {
    index: "03",
    rail: "HEDERA",
    role: "PUBLIC PAYMENT",
    title: "Exact x402 settlement",
    detail: "Blocky402 · HBAR · HashScan",
    logo: "hedera" as const,
  },
  {
    index: "04",
    rail: "HCS",
    role: "HASH ANCHOR",
    title: "Optional evidence anchor",
    detail: "Policy hash · Result hash · PEAC",
    logo: "hcs" as const,
  },
] as const;

const CONTROLS = [
  ["MANDATE", "Budget · velocity · expiry"],
  ["HUMAN REVIEW", "Payment threshold"],
  ["IDEMPOTENCY", "One settlement per request"],
  ["PRIVACY", "Policy values omitted from the result"],
  ["AUDIT", "Hash chain · optional HCS"],
  ["AGENT DX", "llms.txt · OpenAPI · SKILL"],
] as const;

const USES = [
  {
    key: "FINANCE DEMO",
    title: "Lending policy gate",
    tags: ["POLICY CHECK", "AAVE + COMPOUND", "CLEAR / HOLD"],
  },
  {
    key: "AGENT PLATFORMS",
    title: "Paid decision tool",
    tags: ["HTTP 402", "MCP", "PER-CALL METER"],
  },
  {
    key: "OPERATORS",
    title: "Receipt after each hop",
    tags: ["PUBLIC SETTLEMENT", "GRAPH SNAPSHOT", "VERIFY HASHES"],
  },
] as const;

const AGENT_FILES = [
  { n: "01", k: "llms.txt", v: "Machine map", href: "/docs/llms" },
  { n: "02", k: "OpenAPI", v: "HTTP contract", href: "/docs/api" },
  { n: "03", k: "SKILL", v: "Hedera exact retry", href: "/docs/skill" },
  { n: "04", k: "Docs", v: "Articles + Swagger", href: "/docs" },
] as const;

function hop(path: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(path);
  };
}

export function Landing() {
  return (
    <LaunchFrame page="home">
      <main>
        <section className="launch-hero">
          <div className="launch-hero-copy">
            <div className="launch-live">
              <i aria-hidden="true" />
              ETHONLINE 2026 · LIVE TESTNET
            </div>
            <h1>
              Private policy.
              <br />
              Public settlement.
              <br />
              <em>Verifiable evidence.</em>
            </h1>
            <p>Verifiable decision infrastructure for agents. Demo: lending policy gate.</p>
            <div className="launch-actions">
              <a className="launch-button" href="/app" onClick={hop("/app")}>
                RUN LIVE DECISION <b>→</b>
              </a>
              <a className="launch-text-link" href="#integrate">
                POINT YOUR AGENT ↓
              </a>
            </div>
            <div className="launch-capabilities">
              <span>NO API KEY</span>
              <span>AGENT FILES</span>
              <span>HEDERA IN SECONDS</span>
              <span>MANDATE GATED</span>
            </div>
          </div>

          <div className="launch-console" aria-label="Hop decision preview">
            <div className="launch-console-top">
              <span>HOP / PRODUCT PREVIEW</span>
              <b><i /> PROOF FLOW</b>
            </div>
            <div className="launch-console-body">
              <div className="launch-request">
                <small>AGENT REQUEST</small>
                <strong>Aave + Compound utilization gate</strong>
                <span>policy_check · scope: all</span>
              </div>
              <ol>
                <li className="done">
                  <span>01</span>
                  <i />
                  <div><small>HEDERA</small><strong>x402 settled</strong></div>
                  <b>✓</b>
                </li>
                <li className="live">
                  <span>02</span>
                  <i />
                  <div><small>CHAINLINK CRE</small><strong>CRE simulation</strong></div>
                  <b>SIM</b>
                </li>
                <li>
                  <span>03</span>
                  <i />
                  <div><small>THE GRAPH</small><strong>Standardized join</strong></div>
                  <b>WAIT</b>
                </li>
                <li>
                  <span>04</span>
                  <i />
                  <div><small>EVIDENCE</small><strong>Receipt · optional HCS</strong></div>
                  <b>WAIT</b>
                </li>
              </ol>
              <div className="launch-verdict">
                <span>POLICY VERDICT</span>
                <strong>CLEAR</strong>
                <small>threshold remains sealed</small>
              </div>
            </div>
            <div className="launch-scan" aria-hidden="true" />
          </div>
        </section>

        <section className="launch-railbar" aria-label="Integrated infrastructure">
          <span>THE GRAPH <b>STANDARDIZED DATA</b></span>
          <i />
          <span>CHAINLINK CRE <b>CONFIDENTIAL COMPUTE</b></span>
          <i />
          <span>HEDERA <b>AGENT PAYMENTS</b></span>
          <i />
          <span>HCS <b>HASH ANCHOR</b></span>
        </section>

        <section id="product" className="launch-section launch-product">
          <div className="launch-section-head">
            <span>01 / PRODUCT</span>
            <h2>Verifiable decision infrastructure for agents.</h2>
          </div>
          <div className="launch-use-grid">
            {USES.map((item, index) => (
              <article key={item.key}>
                <div>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item.key}</b>
                </div>
                <h3>{item.title}</h3>
                <ul>
                  {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="stack" className="launch-section">
          <div className="launch-section-head">
            <span>02 / PROOF STACK</span>
            <h2>Every rail has one job.</h2>
          </div>
          <div className="launch-stack">
            {STACK.map((item) => (
              <article key={item.index}>
                <span>{item.index}</span>
                <RailLogo id={item.logo} label={item.rail} />
                <div>
                  <small>{item.role}</small>
                  <strong>{item.rail}</strong>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <i>↗</i>
              </article>
            ))}
          </div>
        </section>

        <section id="controls" className="launch-section launch-controls">
          <div className="launch-section-head">
            <span>03 / CONTROLS</span>
            <h2>Mandate before spend.</h2>
          </div>
          <div className="launch-control-grid">
            {CONTROLS.map(([name, detail], index) => (
              <div key={name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </section>

        <section id="integrate" className="launch-section launch-integrate">
          <div className="launch-section-head">
            <span>04 / INTEGRATE</span>
            <h2>Point your agent at these files. Hedera in seconds.</h2>
          </div>
          <p className="launch-integrate-lead">
            No SDK. No API key. The agent reads the contract, pays exact x402, and uses the
            decision API.
          </p>
          <div className="launch-file-grid">
            {AGENT_FILES.map((file) => (
              <a key={file.n} href={file.href} onClick={hop(file.href)}>
                <span>{file.n}</span>
                <strong>{file.k}</strong>
                <small>{file.v}</small>
              </a>
            ))}
          </div>
        </section>

        <section className="launch-cta">
          <div>
            <span>LIVE DEMO</span>
            <h2>One paid request. One decision receipt.</h2>
          </div>
          <div className="launch-cta-actions">
            <a className="launch-button invert" href="/app" onClick={hop("/app")}>
              ENTER DECISION ROOM <b>→</b>
            </a>
            <a href="/docs" onClick={hop("/docs")}>AGENT DOCS</a>
            <a href="/docs/api" onClick={hop("/docs/api")}>OPENAPI</a>
            <a href="/docs/skill" onClick={hop("/docs/skill")}>AGENT SKILL</a>
          </div>
        </section>
      </main>
    </LaunchFrame>
  );
}
