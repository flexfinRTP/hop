import { useState, type MouseEvent } from "react";
import { LaunchFrame } from "./LaunchFrame";
import { HopWordmark } from "./HopWordmark";
import { navigate } from "./nav";
import { RailLogo } from "./RailLogo";

const STACK = [
  {
    index: "01",
    fig: "Fig 1.1",
    rail: "THE GRAPH",
    role: "PUBLIC DATA",
    title: "Standardized lending",
    detail: "Aave v3 + Compound v3 · Messari 3.1.0",
    logo: "graph" as const,
  },
  {
    index: "02",
    fig: "Fig 1.2",
    rail: "CHAINLINK CRE",
    role: "PRIVATE COMPUTE",
    title: "Confidential policy join",
    detail: "handlerInTee · Nitro · simulation",
    logo: "chainlink" as const,
  },
  {
    index: "03",
    fig: "Fig 1.3",
    rail: "HEDERA",
    role: "PUBLIC PAYMENT",
    title: "Exact x402 settlement",
    detail: "Blocky402 · HBAR · HashScan",
    logo: "hedera" as const,
  },
  {
    index: "04",
    fig: "Fig 1.4",
    rail: "HCS",
    role: "HASH ANCHOR",
    title: "Optional evidence anchor",
    detail: "Policy hash · Result hash · PEAC",
    logo: "hcs" as const,
  },
] as const;

const CONTROLS = [
  ["MANDATE", "Budget · velocity · expiry · L1–L3"],
  ["PASSPORT", "Issue · bind · revoke"],
  ["DID / 8004", "Optional audit id. Not required to pay"],
  ["HUMAN REVIEW", "L2 threshold · World uniqueness"],
  ["IDEMPOTENCY", "One settlement per request"],
  ["PRIVACY", "Policy values omitted from the result"],
  ["AUDIT", "Hash chain · optional HCS · /verify/{id}"],
  ["AGENT DX", "llms.txt · OpenAPI · SKILL · Agent Card"],
] as const;

const USES = [
  {
    key: "FINANCE DEMO",
    title: "Lending policy gate",
    tags: ["POLICY CHECK", "AAVE + COMPOUND", "CLEAR / HOLD"],
  },
  {
    key: "AGENT WORKFLOW",
    title: "Tool call before the irreversible call",
    tags: ["HTTP 402", "NO LOGIN", "RECEIPT ID"],
  },
  {
    key: "ENTERPRISE",
    title: "Uninsured process without a receipt",
    tags: ["PUBLIC SETTLEMENT", "VERIFY LINK", "DID OPTIONAL"],
  },
] as const;

const AGENT_FILES = [
  {
    n: "01",
    k: "llms.txt",
    v: "Machine map",
    href: "/docs/llms",
    file: "/llms.txt",
    lang: "markdown",
    preview: `# Hop
Point an agent at this file.
POST /v1/query — Hedera exact x402
GET /verify/{id} — public receipt`,
  },
  {
    n: "02",
    k: "OpenAPI",
    v: "HTTP contract",
    href: "/docs/api",
    file: "/openapi.yaml",
    lang: "yaml",
    preview: `paths:
  /v1/query:
    post:
      summary: Paid decision
      responses:
        "402":
          description: Pay exact x402`,
  },
  {
    n: "03",
    k: "SKILL",
    v: "Hedera exact retry",
    href: "/docs/skill",
    file: "/SKILL.md",
    lang: "markdown",
    preview: `# Hop query
ExactHederaScheme. Not Graph Base USDC.
Idempotency-Key on the paid retry.
Do not invent sources.`,
  },
  {
    n: "04",
    k: "Agent Card",
    v: "A2A + x402",
    href: "/.well-known/agent-card.json",
    file: "/.well-known/agent-card.json",
    lang: "json",
    preview: `{
  "protocol": "a2a",
  "securitySchemes": {
    "x402": {}
  }
}`,
  },
  {
    n: "05",
    k: "DID",
    v: "did:web document",
    href: "/.well-known/did.json",
    file: "/.well-known/did.json",
    lang: "json",
    preview: `{
  "id": "did:web:<origin>",
  "verificationMethod": [],
  "@context": ["https://www.w3.org/ns/did/v1"]
}`,
  },
] as const;

const HOW = [
  {
    n: "01",
    k: "Check the rule",
    v: "Before the agent spends, books, or ships. Your house limit stays private.",
  },
  {
    n: "02",
    k: "Allow or hold",
    v: "ALLOW · HOLD · DENY. If it is not allowed, the irreversible call does not run.",
  },
  {
    n: "03",
    k: "Keep the receipt",
    v: "Public on Hedera. Copy /verify/{id}. Audit gets a link, not a chat screenshot.",
  },
] as const;

const FLOWS = [
  {
    id: "x402" as const,
    tab: "Already on x402",
    title: "One more 402 resource. Before the irreversible call.",
    img: "/brand/flow/flow-x402.png",
    alt: "Agent cube, existing 402 tools, moss Hop gate, then spend or stop, then a receipt.",
    steps: [
      ["Agent", "Existing x402 client. Same 402 retry it already does."],
      ["Other 402 tools", "Stay. Hop is not a replacement pay rail."],
      ["Hop", "POST /v1/query. 402. Hedera exact retry. Idempotency-Key."],
      ["Verdict", "ALLOW · HOLD · DENY. If not allowed, the next call does not run."],
      ["Action", "Only on ALLOW: spend, book, dispatch."],
      ["Receipt", "/verify/{id} on the trace."],
    ],
  },
  {
    id: "mcp" as const,
    tab: "MCP / no x402",
    title: "One skill in the tray. Before the tool that cannot be undone.",
    img: "/brand/flow/flow-mcp.png",
    alt: "Agent tool tray, moss Hop slot inserted, then spend book dispatch tools, then a clipped receipt.",
    steps: [
      ["Agent", "Cursor, Claude, function-calling. Existing MCP / API keys stay."],
      ["Hop skill", "hop_meta then hop_pay. One 402-retry. No login. No API key."],
      ["Verdict", "ALLOW · HOLD · DENY. HOLD / DENY is a result, not an exception."],
      ["Existing tool", "Only on ALLOW: the MCP or API that spends, binds, or actuates."],
      ["Receipt", "verify_path on the ticket. Next agent or human can open it."],
    ],
  },
] as const;

const RAILS = [
  { logo: "graph" as const, name: "THE GRAPH", job: "STANDARDIZED DATA" },
  { logo: "chainlink" as const, name: "CHAINLINK CRE", job: "CONFIDENTIAL COMPUTE" },
  { logo: "hedera" as const, name: "HEDERA", job: "AGENT PAYMENTS" },
  { logo: "hcs" as const, name: "HCS", job: "HASH ANCHOR" },
] as const;

function hop(path: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(path);
  };
}

export function Landing() {
  const [rail, setRail] = useState(1);
  const [flow, setFlow] = useState<(typeof FLOWS)[number]["id"]>("x402");
  const [control, setControl] = useState(0);
  const [file, setFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const selected = STACK[rail];
  const agentFile = AGENT_FILES[file];

  async function copyFile() {
    const url = `${window.location.origin}${agentFile.file}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <LaunchFrame page="home">
      <main className="home">
        <section className="home-hero">
          <p className="home-kicker">
            <i aria-hidden="true" />
            0.1.0 SUNSET · ETHONLINE 2026
          </p>
          <h1>
            Private policy.
            <br />
            Public settlement.
            <br />
            <em>Verifiable evidence.</em>
          </h1>
          <p className="home-lead">
            Before an agent acts, get a decision with a receipt. Demo: lending policy gate.
          </p>
          <div className="home-actions">
            <a className="launch-button" href="/app" onClick={hop("/app")}>
              RUN LIVE DECISION <b>→</b>
            </a>
            <a className="home-ghost" href="#integrate">
              POINT YOUR AGENT ↓
            </a>
          </div>
        </section>

        <section id="how" className="home-how-wrap">
          <header className="home-section-head">
            <span>How it works</span>
            <h2>Check. Decide. Prove.</h2>
          </header>
          <div className="home-how">
            {HOW.map((step) => (
              <article key={step.n}>
                <b>{step.n}</b>
                <h3>{step.k}</h3>
                <p>{step.v}</p>
              </article>
            ))}
          </div>
          <p className="home-how-note">
            The check is a paid Hedera x402 hop. That is the meter. Not pay-then-think.
          </p>
        </section>

        <section id="flow" className="home-section home-plug">
          <header className="home-section-head">
            <span>In the agent loop</span>
            <h2>One hop in front of the irreversible tool call.</h2>
          </header>
          <div className="home-plug-tabs" role="tablist" aria-label="Agent workflows">
            {FLOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={flow === item.id}
                className={flow === item.id ? "on" : ""}
                onClick={() => setFlow(item.id)}
              >
                {item.tab}
              </button>
            ))}
          </div>
          {FLOWS.filter((item) => item.id === flow).map((item) => (
            <div key={item.id} className="home-plug-body">
              <figure>
                <img src={item.img} alt={item.alt} width={1920} height={1080} />
              </figure>
              <div>
                <h3>{item.title}</h3>
                <ol>
                  {item.steps.map(([k, v]) => (
                    <li key={k}>
                      <strong>{k}</strong>
                      <span>{v}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </section>

        <section className="home-stage-wrap" aria-label="Hop decision preview">
          <div className="home-stage">
            <div className="home-stage-chrome">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>hop / decision room</b>
              <small>hedera:testnet</small>
            </div>
            <div className="home-stage-body">
              <aside>
                <HopWordmark />
                <small>DECISION API</small>
                <nav>
                  <span className="on">01 Decision room</span>
                  <span>02 Evidence vault</span>
                  <span>03 Infrastructure</span>
                </nav>
                <ol>
                  <li className="on">The Graph</li>
                  <li className="on">Chainlink CRE</li>
                  <li className="on">Hedera x402</li>
                </ol>
              </aside>
              <div className="home-stage-main">
                <header>
                  <h2>Decision room</h2>
                  <span>policy_check · scope: all</span>
                </header>
                <div className="home-stage-split">
                  <div className="home-stage-request">
                    <small>DECISION REQUEST</small>
                    <strong>Aave + Compound utilization gate</strong>
                    <ul>
                      <li>
                        <b>AAVE V3</b>
                        <em>ON</em>
                      </li>
                      <li>
                        <b>COMPOUND V3</b>
                        <em>ON</em>
                      </li>
                    </ul>
                  </div>
                  <ol className="home-stage-flow">
                    <li className="done">
                      <span>01</span>
                      <div>
                        <small>HEDERA</small>
                        <strong>x402 settled</strong>
                      </div>
                      <b>✓</b>
                    </li>
                    <li className="live">
                      <span>02</span>
                      <div>
                        <small>CHAINLINK CRE</small>
                        <strong>CRE simulation</strong>
                      </div>
                      <b>SIM</b>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <small>THE GRAPH</small>
                        <strong>Standardized join</strong>
                      </div>
                      <b>WAIT</b>
                    </li>
                    <li>
                      <span>04</span>
                      <div>
                        <small>EVIDENCE</small>
                        <strong>Receipt · optional HCS</strong>
                      </div>
                      <b>WAIT</b>
                    </li>
                  </ol>
                </div>
                <div className="home-stage-verdict">
                  <span>POLICY VERDICT</span>
                  <strong>CLEAR</strong>
                  <small>threshold remains sealed</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-stats">
          <div>
            <b>NO API KEY</b>
          </div>
          <div>
            <b>NO LOGIN</b>
          </div>
          <div>
            <b>AGENT FILES</b>
          </div>
          <div>
            <b>HEDERA IN SECONDS</b>
          </div>
        </section>

        <section className="home-logos" aria-label="Integrated infrastructure">
          {RAILS.map((item) => (
            <span key={item.name}>
              <RailLogo id={item.logo} label={item.name} />
              <span>
                {item.name}
                <small>{item.job}</small>
              </span>
            </span>
          ))}
          <span className="home-logos-x402">
            X402
            <small>NOT OAUTH</small>
          </span>
        </section>

        <section id="product" className="home-section">
          <header className="home-section-head">
            <span>Product</span>
            <h2>Verifiable decision infrastructure for agents.</h2>
          </header>

          <article className="home-mod">
            <div>
              <span>{USES[0].key}</span>
              <h3>{USES[0].title}</h3>
              <ul>
                {USES[0].tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
            <div className="home-books" aria-hidden="true">
              <div className="aave">
                <span>AAVE V3</span>
                <i />
              </div>
              <div className="compound">
                <span>COMPOUND V3</span>
                <i />
              </div>
              <div className="home-books-seal">
                <em />
                <span>threshold remains sealed</span>
              </div>
            </div>
          </article>

          <article className="home-mod reverse">
            <div>
              <span>{USES[1].key}</span>
              <h3>{USES[1].title}</h3>
              <ul>
                {USES[1].tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
            <div className="home-http" aria-hidden="true">
              <p>
                <b>POST</b> /v1/query
              </p>
              <p className="pay">← 402 PAYMENT REQUIRED</p>
              <p>x402 settle · hedera · exact</p>
              <p>
                <b>POST</b> /v1/query
              </p>
              <p className="ok">← 200 CLEAR</p>
            </div>
          </article>

          <article className="home-mod">
            <div>
              <span>{USES[2].key}</span>
              <h3>{USES[2].title}</h3>
              <ul>
                {USES[2].tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
            <div className="home-receipt" aria-hidden="true">
              <b>VERIFY</b>
              <dl>
                <div>
                  <dt>VERDICT</dt>
                  <dd>CLEAR</dd>
                </div>
                <div>
                  <dt>SETTLEMENT</dt>
                  <dd>OK</dd>
                </div>
                <div>
                  <dt>DID</dt>
                  <dd>OPTIONAL</dd>
                </div>
              </dl>
              <span>/verify/{"{id}"}</span>
            </div>
          </article>
        </section>

        <section id="stack" className="home-section">
          <header className="home-section-head">
            <span>Proof stack</span>
            <h2>Every rail has one job.</h2>
          </header>
          <div className="home-machine">
            <div className="home-layers" role="tablist" aria-label="Proof stack">
              {STACK.map((item, index) => (
                <button
                  key={item.index}
                  type="button"
                  role="tab"
                  aria-selected={rail === index}
                  className={rail === index ? "on" : ""}
                  onClick={() => setRail(index)}
                >
                  <small>{item.fig}</small>
                  <strong>{item.role}</strong>
                  <span>{item.rail}</span>
                </button>
              ))}
            </div>
            <div className="home-layer-detail">
              <RailLogo id={selected.logo} label={selected.rail} />
              <p>
                <small>{selected.role}</small>
                <strong>{selected.title}</strong>
                {selected.detail}
              </p>
            </div>
          </div>
        </section>

        <section id="controls" className="home-section">
          <header className="home-section-head">
            <span>Controls</span>
            <h2>Mandate before spend.</h2>
          </header>
          <div className="home-desk">
            <div className="home-desk-chrome">
              <span>
                <i />
                <i />
                <i />
              </span>
              <b>operator / controls</b>
            </div>
            <div className="home-desk-body">
              <nav aria-label="Controls">
                {CONTROLS.map(([name], index) => (
                  <button
                    key={name}
                    type="button"
                    className={control === index ? "on" : ""}
                    onClick={() => setControl(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {name}
                  </button>
                ))}
              </nav>
              <div>
                <small>{String(control + 1).padStart(2, "0")}</small>
                <h3>{CONTROLS[control][0]}</h3>
                <p>{CONTROLS[control][1]}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="integrate" className="home-section">
          <header className="home-section-head">
            <span>Integrate</span>
            <h2>Point your agent at these files. Hedera in seconds.</h2>
            <p>
              No SDK. No API key. No login. The agent reads the contract, pays exact x402, and uses
              the decision API. Optional DID stamps the receipt.
            </p>
          </header>
          <div className="home-ide">
            <aside>
              {AGENT_FILES.map((item, index) => (
                <button
                  key={item.k}
                  type="button"
                  className={file === index ? "on" : ""}
                  onClick={() => setFile(index)}
                >
                  <span>{item.n}</span>
                  {item.k}
                </button>
              ))}
            </aside>
            <div>
              <header>
                <span>{agentFile.k}</span>
                <small>{agentFile.v}</small>
                <button type="button" onClick={() => void copyFile()}>
                  {copied ? "COPIED" : "COPY URL"}
                </button>
              </header>
              <pre>
                <code>{agentFile.preview}</code>
              </pre>
              <a
                href={agentFile.href}
                onClick={agentFile.href.startsWith("/docs") ? hop(agentFile.href) : undefined}
              >
                Open {agentFile.k} →
              </a>
            </div>
          </div>
        </section>

        <section className="home-close">
          <div>
            <span>LIVE DEMO</span>
            <h2>One paid request. One decision receipt.</h2>
          </div>
          <div className="home-close-links">
            <a className="launch-button invert" href="/app" onClick={hop("/app")}>
              ENTER DECISION ROOM <b>→</b>
            </a>
            <a href="/docs" onClick={hop("/docs")}>
              AGENT DOCS
            </a>
            <a href="/docs/api" onClick={hop("/docs/api")}>
              OPENAPI
            </a>
            <a href="/docs/skill" onClick={hop("/docs/skill")}>
              AGENT SKILL
            </a>
          </div>
        </section>
      </main>
    </LaunchFrame>
  );
}
