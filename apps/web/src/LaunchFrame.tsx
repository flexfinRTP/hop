import { useState, type MouseEvent, type ReactNode } from "react";
import { HopWordmark } from "./HopWordmark";
import { navigate } from "./nav";

const RAILS = [
  { name: "Hedera", src: "/brand/partners/hedera.svg" },
  { name: "Chainlink", src: "/brand/partners/chainlink.svg" },
  { name: "The Graph", src: "/brand/partners/the-graph-mark.svg" },
  { name: "World ID", src: "/brand/partners/world-id.png" },
] as const;

export function LaunchFrame({
  children,
  page,
}: {
  children: ReactNode;
  page: "home" | "docs";
}) {
  const [open, setOpen] = useState(false);

  function hop(path: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setOpen(false);
      navigate(path);
    };
  }

  const links =
    page === "home" ? (
      <>
        <a href="#how" onClick={() => setOpen(false)}>
          How
        </a>
        <a href="#product" onClick={() => setOpen(false)}>
          Product
        </a>
        <a href="#stack" onClick={() => setOpen(false)}>
          Stack
        </a>
        <a href="#integrate" onClick={() => setOpen(false)}>
          Integrate
        </a>
        <a href="/docs" onClick={hop("/docs")}>
          Docs
        </a>
        <a href="/pitch.html">Deck</a>
      </>
    ) : (
      <>
        <a href="/" onClick={hop("/")}>
          Product
        </a>
        <a href="/docs" onClick={hop("/docs")}>
          Docs
        </a>
        <a href="/docs/skill" onClick={hop("/docs/skill")}>
          Skill
        </a>
        <a href="/docs/api" onClick={hop("/docs/api")}>
          API
        </a>
        <a href="/pitch.html">Deck</a>
      </>
    );

  return (
    <div className={page === "docs" ? "launch-site docs-open" : "launch-site"}>
      <div className="hop-net" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <path
            class="hop-net-line"
            d="M110 200C310 120 430 390 720 310C980 240 1180 370 1330 270"
          />
          <path
            class="hop-net-line"
            d="M70 680C290 760 500 520 760 610C1020 690 1220 540 1370 620"
          />
          <circle class="hop-net-node" cx="110" cy="200" r="3.2" />
          <circle class="hop-net-node hop-net-hop" cx="720" cy="310" r="5.5" />
          <circle class="hop-net-node" cx="1330" cy="270" r="3.2" />
          <circle class="hop-net-node" cx="70" cy="680" r="3.2" />
          <circle class="hop-net-node hop-net-hop delay" cx="760" cy="610" r="5.5" />
          <circle class="hop-net-node" cx="1370" cy="620" r="3.2" />
          <circle class="hop-net-packet a" r="3.4" />
          <circle class="hop-net-packet b" r="3" />
        </svg>
      </div>
      <header className={open ? "launch-nav open" : "launch-nav"}>
        <a className="launch-brand" href="/" onClick={hop("/")}>
          <HopWordmark tone="cream" />
        </a>
        <div className="launch-nav-main">
          <nav>{links}</nav>
          <ul className="launch-rails" aria-label="Built on">
            {RAILS.map((rail) => (
              <li key={rail.name}>
                <img src={rail.src} alt={rail.name} />
              </li>
            ))}
          </ul>
          <a className="launch-button small" href="/app" onClick={hop("/app")}>
            Decision room
          </a>
          <button
            type="button"
            className="launch-menu"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>
      {children}
      <footer className="launch-footer">
        <div className="launch-footer-inner">
          <HopWordmark tone="cream" />
          <p className="launch-built">Built on</p>
          <ul className="launch-built-rails">
            {RAILS.map((rail) => (
              <li key={rail.name}>
                <img src={rail.src} alt="" />
                <span>{rail.name}</span>
              </li>
            ))}
          </ul>
          <div className="launch-footer-bar">
            <nav>
              <a href="/" onClick={hop("/")}>
                Product
              </a>
              <a href="/docs" onClick={hop("/docs")}>
                Docs
              </a>
              <a href="/docs/api" onClick={hop("/docs/api")}>
                API
              </a>
              <a href="/pitch.html">Deck</a>
              <a href="/app" onClick={hop("/app")}>
                Decision room
              </a>
            </nav>
            <small>ETHOnline 2026 · testnet · non-custodial</small>
          </div>
        </div>
      </footer>
    </div>
  );
}
