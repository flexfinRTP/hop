import type { MouseEvent } from "react";
import { LABELS } from "@hop/shared/ui";
import { navigate } from "./nav";

const STEPS = [
  { n: "01", k: "Ask", v: "An agent asks one business question." },
  { n: "02", k: "Protect", v: "Your house rule stays private." },
  { n: "03", k: "Pay", v: "Hedera settles the exact x402 request." },
  { n: "04", k: "Decide", v: "CRE returns a clear stamp." },
  { n: "05", k: "Prove", v: "Evidence is ready for review." },
] as const;

const RAILS = [
  {
    k: "The Graph",
    tag: "PUBLIC DATA",
    title: "Live numbers to measure",
    v: "Messari 3.1.0 lending data gives the check a real market signal.",
  },
  {
    k: "Chainlink CRE",
    tag: "PRIVATE DECISION",
    title: "The rule stays in the TEE",
    v: "handlerInTee compares the house limit without returning the limit.",
  },
  {
    k: "Hedera",
    tag: "PAID ACCESS",
    title: "Every check is explicit",
    v: "Blocky402 exact x402 makes the invoice, payment, and settlement visible.",
  },
  {
    k: "World ID",
    tag: "OPTIONAL TRUST",
    title: "Add a human gate",
    v: "World ID can prove a unique human when a workflow requires it.",
  },
] as const;

const AGENT = [
  {
    k: "Mandate",
    v: "A deterministic spending boundary. The agent cannot raise it or pay past it.",
  },
  {
    k: "PEAC",
    v: "A portable receipt for the decision, payment, and evidence chain.",
  },
  {
    k: "Posture",
    v: `${LABELS.custody} · ${LABELS.ofac} · ${LABELS.mor}`,
  },
] as const;

const OUTCOMES = [
  {
    n: "01",
    k: "Keep the rule private",
    v: "Your threshold stays in the policy table. The response carries the decision, not the secret.",
  },
  {
    n: "02",
    k: "Get an answer agents can use",
    v: "Return over / not over or hold / release instead of a wall of raw data.",
  },
  {
    n: "03",
    k: "Leave a trail",
    v: "Payment, block, hashes, and settlement evidence are ready for an audit or a judge.",
  },
] as const;

const USE_CASES = [
  {
    id: "risk",
    label: "Risk desk",
    question: "Are both lending books over our limit?",
    answer: "Decide whether to escalate without publishing the house threshold.",
    stamp: "over / not over",
  },
  {
    id: "insurance",
    label: "Insurance",
    question: "Did incidents this window go over our limit?",
    answer: "Compare the live count to a private trigger before a layer responds.",
    stamp: "over / not over",
  },
  {
    id: "trade",
    label: "Trade desk",
    question: "Does this reading clear our cutoff?",
    answer: "Release or hold without showing the bank's cutoff to the counterparty.",
    stamp: "hold / release",
  },
] as const;

const EXTRA_PROMPTS = [
  {
    label: "Manufacturing",
    prompt: "Should we pause the line before defects pass our limit?",
    answer: "Flag a maintenance review without exposing the plant's private threshold.",
    result: "run / hold",
  },
  {
    label: "Agriculture",
    prompt: "Has this field crossed the point where we should irrigate?",
    answer: "Trigger action from sensor data without sharing the farm's private cutoff.",
    result: "act / wait",
  },
  {
    label: "Logistics",
    prompt: "Should this shipment be held before it misses the delivery window?",
    answer: "Protect the service promise without exposing the carrier's tolerance.",
    result: "release / hold",
  },
] as const;

const OPENAPI_RAW =
  "https://raw.githubusercontent.com/flexfinRTP/ethonline26/main/openapi/openapi.yaml";

const AGENT_DOCS: {
  n: string;
  k: string;
  v: string;
  href: string;
  ext?: true;
}[] = [
  { n: "01", k: "llms.txt", v: "public explainer · routes · 402", href: "/llms.txt" },
  { n: "02", k: "OpenAPI", v: "POST /v1/query · contract", href: "/openapi.yaml" },
  {
    n: "03",
    k: "Swagger",
    v: "editor",
    href: `https://editor.swagger.io/?url=${encodeURIComponent(OPENAPI_RAW)}`,
    ext: true,
  },
  { n: "04", k: "SKILL", v: "Hedera exact retry · mandate", href: "/SKILL.md" },
  { n: "05", k: "README", v: "Blocky402 · feePayer · MCP", href: "/README.md" },
];

function hop(path: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate(path);
  };
}

export function Site() {
  return (
    <div className="site">
      <header className="site-nav">
        <a className="site-mark" href="/" onClick={hop("/")}>
          <span className="site-mark-dot" aria-hidden="true" />
          Hop
        </a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#proof">Proof</a>
          <a href="/desk" onClick={hop("/desk")}>
            Desk
          </a>
          <a className="site-btn" href="/app" onClick={hop("/app")}>
            Run a check
          </a>
        </nav>
      </header>

      <main>
        <section className="site-hero">
          <div className="site-hero-copy">
            <p className="site-kicker">ETHONLINE 2026 · CONFIDENTIAL AI WORKFLOW</p>
            <p className="site-tagline">Private rules. Clear decisions. Built for agents.</p>
            <h1>Make a private business decision from live market data.</h1>
            <p className="site-hero-subline">Paid, private, verifiable agent decisions.</p>
            <p className="site-lead">
              Hop lets an agent check a house rule without exposing the rule. It returns a
              simple decision, a paid receipt, and proof your team can verify.
            </p>
            <div className="site-cta">
              <a className="site-btn" href="/app" onClick={hop("/app")}>
                Run a live check
              </a>
              <a className="site-btn ghost" href="#how">
                See the workflow
              </a>
            </div>
            <div className="site-hero-proof" aria-label="Hop technology partners">
              <span>Chainlink CRE</span>
              <span>The Graph</span>
              <span>Hedera x402</span>
              <span>World ID</span>
            </div>
          </div>
          <figure className="site-hero-visual">
            <div className="site-visual-frame mascot-frame">
              <img
                className="site-mascot-image"
                src="/brand/hop-cute-bunny-clean.png"
                alt="A hand-drawn HOP bunny mascot running with a plain red scarf"
              />
              <div className="site-mascot-card">
                <span>HOP / AGENT INFRA</span>
                <strong>ROUTE READY</strong>
                <small>private rule · paid call</small>
              </div>
              <span className="site-mascot-orbit site-mascot-orbit-a">AGENT</span>
              <span className="site-mascot-orbit site-mascot-orbit-b">TEE</span>
            </div>
            <figcaption>Big ears. Small leak. One clear answer.</figcaption>
          </figure>
        </section>

        <section className="site-proof-strip" aria-label="What Hop delivers">
          <span>PRIVATE RULE</span>
          <b>→</b>
          <span>PAID CHECK</span>
          <b>→</b>
          <span>CLEAR STAMP</span>
          <b>→</b>
          <span>VERIFIABLE RECEIPT</span>
        </section>

        <section className="site-block site-outcomes">
          <div className="site-section-heading">
            <p className="site-kicker">THE BUSINESS CASE</p>
            <h2>Useful answers without giving away the rule.</h2>
            <p>
              Your agent gets a result it can act on. Your team keeps control of the number
              behind that result.
            </p>
          </div>
          <div className="site-outcome-grid">
            {OUTCOMES.map((outcome) => (
              <article key={outcome.n} className="site-outcome">
                <span>{outcome.n}</span>
                <h3>{outcome.k}</h3>
                <p>{outcome.v}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="site-block site-how">
          <div className="site-section-heading">
            <p className="site-kicker">HOW ONE HOP WORKS</p>
            <h2>Five steps from a question to proof.</h2>
            <p>
              The interface is simple. The workflow is serious enough for a paid agent call
              and a reviewable decision.
            </p>
          </div>
          <ol className="site-path">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span>{s.n}</span>
                <strong>{s.k}</strong>
                <em>{s.v}</em>
              </li>
            ))}
          </ol>
        </section>

        <section id="use-cases" className="site-block site-use-cases">
          <div className="site-section-heading">
            <p className="site-kicker">THREE DESKS · ONE API</p>
            <h2>Start with the question your team already asks.</h2>
            <p>
              Risk, insurance, and trade use different words for the same job: check a
              private rule against a live signal.
            </p>
          </div>
          <div className="site-use-grid">
            {USE_CASES.map((useCase) => (
              <article key={useCase.id} className="site-use-card">
                <div className="site-use-label">
                  <span className={`site-use-marker ${useCase.id}`} />
                  {useCase.label}
                </div>
                <h3>{useCase.question}</h3>
                <p>{useCase.answer}</p>
                <strong>{useCase.stamp}</strong>
              </article>
            ))}
          </div>
          <p className="site-note">
            Demo data: live Graph lending numbers. The policy rule stays private in the
            workflow.
          </p>
          <div className="site-prompt-heading">
            <span>MORE PROMPT PATTERNS</span>
            <p>Plain-English examples for teams that want the same private check.</p>
          </div>
          <div className="site-prompt-grid">
            {EXTRA_PROMPTS.map((prompt) => (
              <article key={prompt.label} className="site-prompt-card">
                <span className="site-prompt-label">{prompt.label}</span>
                <h3>{prompt.prompt}</h3>
                <p>{prompt.answer}</p>
                <strong>{prompt.result}</strong>
              </article>
            ))}
          </div>
          <p className="site-note">
            These are prompt patterns. The current demo uses the same policy_check path and
            live Graph lending signal.
          </p>
        </section>

        <section id="proof" className="site-block site-rails">
          <div className="site-section-heading">
            <p className="site-kicker">BUILT FOR THE JUDGES</p>
            <h2>Every partner has a job in the proof.</h2>
            <p>
              This is not a payment demo wearing a privacy badge. The data, decision,
              payment, and evidence each have a defined rail.
            </p>
          </div>
          <div className="site-rail-grid">
            {RAILS.map((r) => (
              <article key={r.k} className="site-rail-card">
                <span className="site-rail-tag">{r.tag}</span>
                <h3>{r.k}</h3>
                <strong>{r.title}</strong>
                <p>{r.v}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="agent" className="site-block site-agent">
          <div className="site-agent-copy">
            <p className="site-kicker">FOR AGENTS AND BUILDERS</p>
            <h2>Give your agent the contract, not a guess.</h2>
            <p>
              Start with the public explainer. Then use the OpenAPI contract to send a
              fixed query, handle the HTTP 402, and retry with Hedera exact payment.
            </p>
            <div className="site-agent-links">
              <a className="site-btn" href="/llms.txt">
                Read the agent explainer
              </a>
              <a className="site-btn ghost" href="/openapi.yaml">
                Open OpenAPI
              </a>
            </div>
          </div>
          <ol className="site-doc-list">
            {AGENT_DOCS.map((d) => (
              <li key={d.n}>
                <span>{d.n}</span>
                <a
                  href={d.href}
                  {...(d.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  <strong>{d.k}</strong>
                  <em>{d.v}</em>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="site-block site-agent-model">
          <div className="site-section-heading">
            <p className="site-kicker">GUARDRAILS THAT TRAVEL WITH THE CALL</p>
            <h2>More than a stamp. A complete agent handoff.</h2>
          </div>
          <div className="site-grid three">
            {AGENT.map((r) => (
              <article key={r.k} className="site-card">
                <h3>{r.k}</h3>
                <p>{r.v}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <p>Hop · ETHOnline 2026</p>
        <p>The Graph · Hedera · Chainlink CRE · World ID · {LABELS.custody}</p>
      </footer>
    </div>
  );
}
