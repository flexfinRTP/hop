import { useState } from "react";
import { LABELS, QUERY_TYPES, type QueryType } from "@hop/shared";

type UiStatus =
  | "unpaid"
  | "policy_unavailable"
  | "stale"
  | "k_anon_denied"
  | "success"
  | "not_implemented";

export function App() {
  const [query, setQuery] = useState<QueryType>("policy_check");
  const [protocols, setProtocols] = useState("aave-v3,compound-v3");
  const [maxBlockLag, setMaxBlockLag] = useState("50");
  const [status] = useState<UiStatus>("unpaid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const evidenceJson = "{}";

  return (
    <main>
      <header>
        <h1>HOP</h1>
        <div className="badges">
          <span>{LABELS.cre}</span>
          <span>{LABELS.rails}</span>
        </div>
      </header>

      <section>
        <label htmlFor="query">query</label>
        <select
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value as QueryType)}
        >
          {QUERY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label htmlFor="protocols">protocols</label>
        <input
          id="protocols"
          value={protocols}
          onChange={(e) => setProtocols(e.target.value)}
        />

        <label htmlFor="lag">max_block_lag</label>
        <input
          id="lag"
          type="number"
          min={0}
          value={maxBlockLag}
          onChange={(e) => setMaxBlockLag(e.target.value)}
        />

        <p className="status">status: {status}</p>
        <button type="button" disabled>
          POST /v1/query
        </button>
      </section>

      <aside>
        <button type="button" onClick={() => setDrawerOpen((o) => !o)}>
          Evidence
        </button>
        {drawerOpen ? (
          <>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([evidenceJson], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "evidence.json";
                a.click();
              }}
            >
              export JSON
            </button>
            <pre>{evidenceJson}</pre>
          </>
        ) : null}
      </aside>
    </main>
  );
}
