import type { MouseEvent } from "react";
import { INDUSTRY_CHIPS, LABELS } from "@hop/shared/ui";
import { navigate } from "./nav";

const STEPS = [
  { n: "01", k: "Ask", v: "Risk · Insurance · Trade" },
  { n: "02", k: "Mandate", v: "budget · velocity · HITL" },
  { n: "03", k: "Pay", v: "metered HBAR · hedera:testnet · 0.0.0" },
  { n: "04", k: "Stamp", v: "over / not over · hold / release" },
  { n: "05", k: "File", v: "evidence · PEAC · HCS" },
] as const;

const RAILS = [
  { k: "Graph", v: "public join · Messari 3.1.0" },
  { k: "Hedera", v: "Blocky402 exact · HCS hash" },
  { k: "CRE", v: "handlerInTee · Nitro · HTTP" },
  { k: "World", v: LABELS.world },
] as const;

const AGENT = [
  { k: "Mandate", v: LABELS.mandate },
  { k: "PEAC", v: LABELS.peac },
  { k: "Posture", v: `${LABELS.custody} · ${LABELS.ofac} · ${LABELS.mor}` },
] as const;

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
          Hop
        </a>
        <nav>
          <a href="#desks">Desks</a>
          <a href="#path">Path</a>
          <a href="https://github.com/flexfinRTP/ethonline26/blob/main/openapi/openapi.yaml">
            OpenAPI
          </a>
          <a href="/desk" onClick={hop("/desk")}>
            Desk
          </a>
          <a className="site-btn" href="/app" onClick={hop("/app")}>
            Check
          </a>
        </nav>
      </header>

      <main>
        <section className="site-hero">
          <p className="site-kicker">POST /v1/query</p>
          <h1>Paid policy check.</h1>
          <p className="site-lead">
            CRE handlerInTee · Graph Messari 3.1.0 · Hedera 402 · World ID
          </p>
          <div className="site-cta">
            <a className="site-btn" href="/app" onClick={hop("/app")}>
              Check
            </a>
            <a className="site-btn ghost" href="/desk" onClick={hop("/desk")}>
              Desk
            </a>
          </div>
          <p className="site-meta">
            {LABELS.rails} · {LABELS.cre} · {LABELS.demoGraph} · {LABELS.mandate}
          </p>
        </section>

        <section id="desks" className="site-block">
          <h2>Desks</h2>
          <div className="site-grid">
            {INDUSTRY_CHIPS.filter((c) => c.id !== "tvl").map((c) => (
              <article key={c.id} className="site-card">
                <h3>{c.label}</h3>
                <p>{c.ask}</p>
                <p className="site-stamp-pair">
                  {c.over} / {c.clear}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="path" className="site-block">
          <h2>Path</h2>
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

        <section className="site-block">
          <h2>Rails</h2>
          <div className="site-grid three">
            {RAILS.map((r) => (
              <article key={r.k} className="site-card">
                <h3>{r.k}</h3>
                <p>{r.v}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-block">
          <h2>Agent</h2>
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
        <p>
          The Graph · Hedera · Chainlink CRE · World ID · {LABELS.custody} · {LABELS.ofac} · {LABELS.mor}
        </p>
      </footer>
    </div>
  );
}
