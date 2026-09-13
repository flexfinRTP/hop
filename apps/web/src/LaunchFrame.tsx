import type { MouseEvent, ReactNode } from "react";
import { navigate } from "./nav";

function hop(path: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(path);
  };
}

export function LaunchFrame({
  children,
  page,
}: {
  children: ReactNode;
  page: "home" | "docs";
}) {
  return (
    <div className={page === "docs" ? "launch-site docs-open" : "launch-site"}>
      <header className="launch-nav">
        <a className="launch-brand" href="/" onClick={hop("/")}>
          <span>H</span>
          <strong>HOP</strong>
        </a>
        <nav>
          {page === "home" ? (
            <>
              <a href="#product">Product</a>
              <a href="#stack">Proof stack</a>
              <a href="#integrate">Integrate</a>
              <a href="/docs" onClick={hop("/docs")}>
                Docs
              </a>
            </>
          ) : (
            <>
              <a href="/" onClick={hop("/")}>
                Product
              </a>
              <a href="/docs" onClick={hop("/docs")}>
                Integrate
              </a>
              <a href="/docs/skill" onClick={hop("/docs/skill")}>
                Skill
              </a>
              <a href="/docs/api" onClick={hop("/docs/api")}>
                API
              </a>
            </>
          )}
        </nav>
        <a className="launch-button small" href="/app" onClick={hop("/app")}>
          OPEN DECISION ROOM <b>→</b>
        </a>
      </header>
      {children}
      <footer className="launch-footer">
        <span>HOP · ETHONLINE 2026</span>
        <span>NON-CUSTODIAL · TESTNET PAYEE · OFAC NOT SCREENED · CRE SIMULATION</span>
        <span>THE GRAPH · CHAINLINK CRE · HEDERA</span>
      </footer>
    </div>
  );
}
