import { useEffect, useMemo, useRef, useState } from "react";
import {
  INDUSTRY_CHIPS,
  LABELS,
  QUERY_TYPES,
  wallFromAggregate,
  type QueryType,
} from "@hop/shared";
import { getEvidence, postQuery, signDemo, type QueryBody } from "./api";

type UiStatus =
  | "idle"
  | "unpaid"
  | "policy_unavailable"
  | "stale"
  | "k_anon_denied"
  | "success"
  | "reject"
  | "pending";

const CHIPS: { id: string; label: string; ask: string; query: QueryType }[] = [
  { ...INDUSTRY_CHIPS[0], query: "policy_check" },
  { ...INDUSTRY_CHIPS[1], query: "policy_check" },
  { ...INDUSTRY_CHIPS[2], query: "policy_check" },
];

function newTraceId(): string {
  return crypto.randomUUID();
}

export function App() {
  const [query, setQuery] = useState<QueryType>("policy_check");
  const [protocols, setProtocols] = useState("aave-v3,compound-v3");
  const [maxBlockLag, setMaxBlockLag] = useState("50");
  const [textOpen, setTextOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [status, setStatus] = useState<UiStatus>("idle");
  const [pending, setPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [muteTts, setMuteTts] = useState(true);
  const [confirmPay, setConfirmPay] = useState(false);
  const [trace, setTrace] = useState<{ t: string; rail: string; msg: string }[]>([]);
  const [rails, setRails] = useState({ graph: false, hedera: false, cre: false });
  const [evidenceJson, setEvidenceJson] = useState("{}");
  const [aggregate, setAggregate] = useState<Record<string, unknown> | undefined>();
  const [paidOnce, setPaidOnce] = useState(false);
  const [chip, setChip] = useState<string>("risk");
  const recRef = useRef<SpeechRecognition | null>(null);

  const body: QueryBody = useMemo(
    () => ({
      query,
      protocols: protocols.split(",").map((s) => s.trim()).filter(Boolean),
      max_block_lag: Number(maxBlockLag) || 0,
    }),
    [query, protocols, maxBlockLag],
  );

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: { new (): SpeechRecognition };
      webkitSpeechRecognition?: { new (): SpeechRecognition };
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      setAsk(said);
      const lower = said.toLowerCase();
      if (lower.includes("incident") || lower.includes("liquidation")) {
        setChip("insurance");
        setQuery("policy_check");
      } else if (lower.includes("cutoff") || lower.includes("release")) {
        setChip("trade");
        setQuery("policy_check");
      } else {
        setChip("risk");
        setQuery("policy_check");
      }
    };
    recRef.current = rec;
  }, []);

  function applyTrace(events: { t: string; rail: string; msg: string }[]) {
    setTrace(events);
    setRails({
      graph: events.some((e) => e.rail === "graph"),
      hedera: events.some((e) => e.rail === "hedera"),
      cre: events.some((e) => e.rail === "cre"),
    });
  }

  function mapStatus(http: number, json: Record<string, unknown>): UiStatus {
    if (http === 402) return "unpaid";
    if (http === 503 && json.error === "policy_unavailable") return "policy_unavailable";
    if (json.status === "stale") return "stale";
    if (json.status === "k_anon_denied") return "k_anon_denied";
    if (json.status === "reject") return "reject";
    if (http === 200) return "success";
    return "idle";
  }

  async function runHop() {
    setPending(true);
    setStatus("pending");
    const traceId = newTraceId();
    const idem = crypto.randomUUID();
    try {
      const first = await postQuery(body, { traceId });
      applyTrace((first.json.trace as typeof trace) ?? []);
      if (first.status !== 402) {
        setStatus(mapStatus(first.status, first.json));
        return;
      }
      if (confirmPay === false && Number(import.meta.env.VITE_CONFIRM_TINYBARS ?? 0) > 0) {
        setConfirmPay(true);
        setPending(false);
        return;
      }
      const accepts = first.json.accepts as unknown[] | undefined;
      const payment = await signDemo(accepts?.[0]);
      const paid = await postQuery(body, { payment, idem, traceId });
      applyTrace((paid.json.trace as typeof trace) ?? []);
      const st = mapStatus(paid.status, paid.json);
      setStatus(st);
      if (paid.json.aggregate && typeof paid.json.aggregate === "object") {
        setAggregate(paid.json.aggregate as Record<string, unknown>);
      }
      const ev = paid.json.evidence as { id?: string } | undefined;
      if (ev?.id) {
        const pack = await getEvidence(ev.id);
        setEvidenceJson(JSON.stringify(pack, null, 2));
      } else {
        setEvidenceJson(JSON.stringify(paid.json, null, 2));
      }
      if (paid.status === 200) {
        setPaidOnce(true);
        speak(st, paid.json.aggregate as Record<string, unknown> | undefined);
      }
    } catch (err) {
      setStatus("unpaid");
      applyTrace([{ t: new Date().toISOString(), rail: "hop", msg: String(err) }]);
    } finally {
      setPending(false);
      setConfirmPay(false);
    }
  }

  function speak(st: UiStatus, agg: Record<string, unknown> | undefined) {
    if (muteTts) return;
    const text = `${st} ${agg?.breached === true ? "breached" : "clear"}`;
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
  }

  const wall = wallFromAggregate(aggregate, 0.2);

  return (
    <div className="desk">
      <div className="window" aria-hidden="true">
        <div className="rain" />
      </div>
      <div className="surface">
        <Bunny pending={pending} />
        <div className="laptop">
          <header>
            <h1>HOP</h1>
            <div className="badges">
              <span>{LABELS.cre}</span>
              <span>{LABELS.rails}</span>
              <span>{LABELS.demoGraph}</span>
            </div>
          </header>

          <nav className="rail" aria-label="partners">
            <span className={rails.graph ? "on" : ""}>Graph</span>
            <span className={rails.hedera ? "on" : ""}>Hedera</span>
            <span className={rails.cre ? "on" : ""}>CRE</span>
          </nav>

          <section className="ask">
            <button
              type="button"
              className="mic"
              onClick={() => recRef.current?.start()}
              aria-label="mic"
            >
              mic
            </button>
            <button type="button" onClick={() => setTextOpen((v) => !v)}>
              text
            </button>
            {textOpen ? (
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                aria-label="ask"
              />
            ) : null}
            <label htmlFor="mute">mute TTS</label>
            <input
              id="mute"
              type="checkbox"
              checked={muteTts}
              onChange={(e) => setMuteTts(e.target.checked)}
            />
          </section>

          <section className="chips">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={chip === c.id ? "on" : ""}
                onClick={() => {
                  setChip(c.id);
                  setQuery(c.query);
                  setAsk(c.ask);
                }}
              >
                {c.label}
              </button>
            ))}
            {paidOnce ? (
              <button type="button" onClick={() => setWallOpen(true)}>
                WALL
              </button>
            ) : null}
          </section>

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
            {confirmPay ? (
              <button type="button" onClick={() => void runHop()}>
                confirm pay
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={() => void runHop()}>
                POST /v1/query
              </button>
            )}
          </section>

          <section className="trace">
            <pre>
              {trace.map((e) => `${e.t} [${e.rail}] ${e.msg}`).join("\n") || "—"}
            </pre>
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

          {wallOpen ? (
            <section>
              <p>WALL</p>
              <p>sleeve: {wall.sleeve}</p>
              <p>buffer: {wall.buffer}</p>
              <p>observed: {wall.observed}</p>
              <p>{wall.ats}</p>
              <p>graph_pull: {String(wall.graph_pull)}</p>
              <p>x402: {String(wall.x402)}</p>
              <button type="button" onClick={() => setWallOpen(false)}>
                close
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bunny({ pending }: { pending: boolean }) {
  return (
    <div className={`bunny ${pending ? "run" : "sit"}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="72" height="72">
        <ellipse cx="32" cy="40" rx="14" ry="12" fill="#f3e6d8" />
        <ellipse cx="24" cy="18" rx="4" ry="12" fill="#f3e6d8" />
        <ellipse cx="40" cy="18" rx="4" ry="12" fill="#f3e6d8" />
        <circle cx="28" cy="38" r="1.5" fill="#222" />
        <circle cx="36" cy="38" r="1.5" fill="#222" />
        <ellipse cx="32" cy="43" rx="2" ry="1.2" fill="#d9a" />
      </svg>
      <div className="wheel" />
    </div>
  );
}

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
};

type SpeechRecognitionEvent = {
  results: { [i: number]: { [j: number]: { transcript: string } } };
};
