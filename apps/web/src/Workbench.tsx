import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FLOW,
  HELP,
  INDUSTRY_CHIPS,
  LABELS,
  QUERY_TYPES,
  STATUS_LABEL,
  STATUS_HELP,
  wallFromAggregate,
  type QueryType,
} from "@hop/shared/ui";
import { getEvidence, getMeta, getPeac, getVerify, openTrace, postQuery, signDemo, type Meta, type QueryBody } from "./api";
import { WorldIdButton } from "./WorldId";
import { navigate } from "./nav";

type UiStatus =
  | "idle"
  | "unpaid"
  | "policy_unavailable"
  | "graph_unconfigured"
  | "cre_unavailable"
  | "facilitator_unavailable"
  | "merchant_unconfigured"
  | "mandate_review"
  | "mandate_denied"
  | "rate_limited"
  | "payer_denied"
  | "world_required"
  | "stale"
  | "k_anon_denied"
  | "success"
  | "reject"
  | "error"
  | "pending";

const CHIPS: {
  id: string;
  label: string;
  ask: string;
  over: string;
  clear: string;
  query: QueryType;
}[] = INDUSTRY_CHIPS.map((c) => ({ ...c, query: "policy_check" as const }));

const RUN_STEPS = ["ask", "pay", "check", "prove"] as const;

function newTraceId(): string {
  return crypto.randomUUID();
}

function isInvoice(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as { x402Version?: unknown; accepts?: unknown };
  return row.x402Version !== undefined || Array.isArray(row.accepts);
}

function hashscanTx(ref: string): string {
  const m = ref.match(/^(.+)@(\d+)\.(\d+)$/);
  const id = m ? `${m[1]}-${m[2]}-${m[3]}` : ref.replace("@", "-");
  return `https://hashscan.io/testnet/transaction/${id}`;
}

function receiptText(raw: string): string {
  if (!raw || raw.includes("x402Version")) return "—";
  try {
    const pack = JSON.parse(raw) as {
      id?: string;
      status?: string;
      settlement?: { ref?: string };
      policy?: { threshold_hash?: string };
      graph?: { deployments?: { slug?: string; block?: number }[] };
      aggregate_hash?: string;
      hcs_seq?: number;
      mandate?: { id?: string; remaining_tinybars?: number };
      chain?: { hash?: string };
      reason?: { freshness?: string };
      cre?: { mode?: string; tee?: string; report_hash?: string };
      world?: { nullifier_hash?: string };
    };
    if (isInvoice(pack)) return "—";
    const lines = [
      pack.id ? `id ${pack.id}` : "",
      pack.status ? `stamp ${pack.status}` : "",
      pack.settlement?.ref ? `settlement ${pack.settlement.ref}` : "",
      pack.policy?.threshold_hash ? `policy ${pack.policy.threshold_hash}` : "",
      pack.aggregate_hash ? `aggregate ${pack.aggregate_hash}` : "",
      pack.hcs_seq !== undefined ? `hcs ${pack.hcs_seq}` : "",
      pack.mandate?.id ? `mandate ${pack.mandate.id} ${pack.mandate.remaining_tinybars}` : "",
      pack.chain?.hash ? `chain ${pack.chain.hash}` : "",
      pack.reason?.freshness ? `freshness ${pack.reason.freshness}` : "",
      pack.cre?.mode ? `cre ${pack.cre.mode} ${pack.cre.tee ?? ""}`.trim() : "",
      pack.cre?.report_hash ? `cre_report ${pack.cre.report_hash}` : "",
      pack.world?.nullifier_hash ? `world ${pack.world.nullifier_hash}` : "",
      ...(pack.graph?.deployments ?? []).map(
        (d) => `${d.slug ?? "graph"} block ${d.block ?? "—"}`,
      ),
    ].filter(Boolean);
    return lines.join("\n") || "—";
  } catch {
    return "—";
  }
}

function stampLabel(chipId: string, breached: boolean): string {
  const chip = CHIPS.find((c) => c.id === chipId) ?? CHIPS[0];
  return breached ? chip.over : chip.clear;
}

function shortT(t: string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toISOString().slice(11, 23);
}

function formatRuntime(milliseconds: number): string {
  if (!milliseconds) return "—";
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds % 60).toFixed(0).padStart(2, "0")}s`;
}

function receiptRows(raw: string): { k: string; v: string }[] {
  const text = receiptText(raw);
  if (text === "—") return [];
  return text.split("\n").map((line) => {
    const i = line.indexOf(" ");
    return i === -1 ? { k: line, v: "" } : { k: line.slice(0, i), v: line.slice(i + 1) };
  });
}

function Info({ text, place }: { text: string; place?: "up" | "end" }) {
  const id = useId();
  const [on, setOn] = useState(false);
  return (
    <span className={`info${on ? " open" : ""}${place ? ` ${place}` : ""}`}>
      <button
        type="button"
        className="info-i"
        aria-label="info"
        aria-describedby={id}
        aria-expanded={on}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOn((v) => !v);
        }}
        onBlur={() => setOn(false)}
      >
        i
      </button>
      <span id={id} className="info-tip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function FlowLine() {
  return (
    <p className="flow-line">
      {FLOW.map((step, i) => (
        <span key={step}>
          {step}
          {i < FLOW.length - 1 ? (
            <span className="flow-arrow" aria-hidden="true">
              →
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

function chipHelp(id: string): string {
  if (id === "risk") return HELP.risk;
  if (id === "insurance") return HELP.insurance;
  if (id === "trade") return HELP.trade;
  if (id === "tvl") return HELP.tvl;
  return HELP.ask;
}

function sourceLabel(protocols: string[]): string {
  return (
    protocols
      .map((protocol) => protocol.replace(/-v3$/, " v3").replaceAll("-", " "))
      .join(" + ") || "—"
  );
}

function railLabel(rail: string): string {
  return (
    {
      graph: "data",
      hedera: "payment",
      cre: "private",
      world: "human",
      hop: "hop",
    }[rail] ?? rail
  );
}

function receiptLabel(key: string): string {
  return (
    {
      id: "Receipt ID",
      stamp: "Decision",
      settlement: "Payment",
      policy: "Private policy proof",
      aggregate: "Result proof",
      hcs: "Hedera anchor",
      mandate: "Agent budget",
      chain: "Receipt chain",
      freshness: "Data freshness",
      cre: "Private workflow",
      cre_report: "Workflow proof",
      world: "Human proof",
    }[key] ?? key.replaceAll("_", " ")
  );
}

const QUERY_LABELS: Record<QueryType, string> = {
  market_params: "Market settings",
  position_counts: "Position count",
  liquidations: "Liquidation count",
  policy_check: "Private limit check",
  account_ltv: "Account loan-to-value",
};

export function Workbench({
  variant,
  onPending,
}: {
  variant: "desk" | "app";
  onPending?: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState<QueryType>("policy_check");
  const [protocols, setProtocols] = useState("aave-v3,compound-v3");
  const [maxBlockLag, setMaxBlockLag] = useState("50");
  const [textOpen, setTextOpen] = useState(false);
  const [ask, setAsk] = useState(CHIPS[0].ask);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [pending, setPending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(variant === "desk");
  const [wallOpen, setWallOpen] = useState(false);
  const [muteTts, setMuteTts] = useState(true);
  const [confirmPay, setConfirmPay] = useState(false);
  const [trace, setTrace] = useState<{ t: string; rail: string; msg: string }[]>([]);
  const [rails, setRails] = useState({ graph: false, hedera: false, cre: false, world: false });
  const [evidenceJson, setEvidenceJson] = useState("");
  const [aggregate, setAggregate] = useState<Record<string, unknown> | undefined>();
  const [paidOnce, setPaidOnce] = useState(false);
  const [chip, setChip] = useState<string>("risk");
  const [xPayment, setXPayment] = useState("");
  const [worldToken, setWorldToken] = useState("");
  const [settlement, setSettlement] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaStatus, setMetaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runtimeMs, setRuntimeMs] = useState(0);
  const recRef = useRef<SpeechRecognition | null>(null);
  const closeTrace = useRef<(() => void) | null>(null);

  useEffect(() => {
    onPending?.(pending);
  }, [pending, onPending]);

  useEffect(() => {
    if (runStartedAt === null) return;
    const timer = window.setInterval(() => {
      setRuntimeMs(Date.now() - runStartedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [runStartedAt]);

  const body: QueryBody = useMemo(
    () => ({
      query,
      protocols: protocols.split(",").map((s) => s.trim()).filter(Boolean),
      max_block_lag: Number(maxBlockLag) || 0,
    }),
    [query, protocols, maxBlockLag],
  );

  async function refreshMeta() {
    setMetaStatus("loading");
    try {
      const m = await getMeta();
      if (!m || !Array.isArray(m.protocols)) throw new Error("meta_shape");
      setMeta(m);
      const keys = m.protocols
        .filter((protocol) => protocol.configured)
        .map((protocol) => protocol.key)
        .join(",");
      setProtocols(keys);
      setMetaStatus("ready");
    } catch {
      setMetaStatus("error");
    }
  }

  function toggleProtocol(key: string) {
    const selected = protocols.split(",").map((value) => value.trim()).filter(Boolean);
    if (selected.includes(key)) {
      if (selected.length === 1) return;
      setProtocols(selected.filter((value) => value !== key).join(","));
      return;
    }
    if (selected.length >= 2) return;
    setProtocols([...selected, key].join(","));
  }

  useEffect(() => {
    void refreshMeta();
  }, []);

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
      world: events.some((e) => e.rail === "world"),
    });
  }

  function mapStatus(http: number, json: Record<string, unknown>): UiStatus {
    if (http === 402) return "unpaid";
    if (http === 429) return "rate_limited";
    if (http === 403 && json.error === "mandate_review") return "mandate_review";
    if (http === 403 && json.error === "payer_denied") return "payer_denied";
    if (http === 403 && json.error === "world_required") return "world_required";
    if (http === 403) return "mandate_denied";
    if (http === 503 && json.error === "graph_unconfigured") return "graph_unconfigured";
    if (http === 503 && json.error === "cre_unavailable") return "cre_unavailable";
    if (http === 503 && json.error === "facilitator_unavailable") return "facilitator_unavailable";
    if (http === 503 && json.error === "merchant_unconfigured") return "merchant_unconfigured";
    if (http === 503 && json.error === "policy_unavailable") return "policy_unavailable";
    if (http === 503) return "policy_unavailable";
    if (json.status === "stale") return "stale";
    if (json.status === "k_anon_denied") return "k_anon_denied";
    if (json.status === "reject") return "reject";
    if (http === 200) return "success";
    return "idle";
  }

  function pushTrace(ev: { t: string; rail: string; msg: string }) {
    setTrace((prev) => {
      const next = [...prev, ev];
      setRails({
        graph: next.some((e) => e.rail === "graph"),
        hedera: next.some((e) => e.rail === "hedera"),
        cre: next.some((e) => e.rail === "cre"),
        world: next.some((e) => e.rail === "world"),
      });
      return next;
    });
  }

  async function runHop() {
    setPending(true);
    setStatus("pending");
    setTraceOpen(true);
    setDrawerOpen(false);
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setRuntimeMs(0);
    setTrace([]);
    setEvidenceJson("");
    setSettlement("");
    setEvidenceId("");
    setAggregate(undefined);
    const traceId = newTraceId();
    const idem = crypto.randomUUID();
    let keepActivityOpen = false;
    let openReceipt = false;
    closeTrace.current?.();
    closeTrace.current = openTrace(traceId, pushTrace);
      const mandate =
      meta?.mandate?.template ? JSON.stringify(meta.mandate.template) : undefined;
    const world = worldToken || undefined;
    const needHitl =
      (meta?.mandate?.human_threshold_tinybars ?? 0) > 0 ||
      Number(import.meta.env.VITE_CONFIRM_TINYBARS ?? 0) > 0;
    try {
      const first = await postQuery(body, { traceId, mandate, world });
      applyTrace((first.json.trace as typeof trace) ?? []);
      if (first.status !== 402) {
        setStatus(mapStatus(first.status, first.json));
        if (first.json.evidence && !isInvoice(first.json.evidence) && !isInvoice(first.json)) {
          setEvidenceJson(JSON.stringify(first.json.evidence, null, 2));
          openReceipt = true;
        }
        return;
      }
      pushTrace({
        t: new Date().toISOString(),
        rail: "hedera",
        msg: `invoice ${String((first.json.accepts as { amount?: string }[] | undefined)?.[0]?.amount ?? meta?.amount ?? "100000")} tinybars`,
      });
      if (!confirmPay && needHitl) {
        setConfirmPay(true);
        setStatus("mandate_review");
        keepActivityOpen = true;
        return;
      }
      const accepts = first.json.accepts as unknown[] | undefined;
      let payment = xPayment.trim();
      if (!payment && meta?.demo_sign) {
        payment = await signDemo(accepts?.[0]);
      }
      if (!payment) {
        setStatus("unpaid");
        return;
      }
      const paid = await postQuery(body, {
        payment,
        idem,
        traceId,
        mandate,
        world,
        confirm: confirmPay || !needHitl,
      });
      applyTrace((paid.json.trace as typeof trace) ?? []);
      if (paid.status === 402 || isInvoice(paid.json)) {
        setStatus("unpaid");
        pushTrace({ t: new Date().toISOString(), rail: "hedera", msg: "retry still invoice" });
        return;
      }
      const st = mapStatus(paid.status, paid.json);
      setStatus(st);
      if (st === "mandate_review") {
        setConfirmPay(true);
        keepActivityOpen = true;
        return;
      }
      if (paid.json.aggregate && typeof paid.json.aggregate === "object") {
        setAggregate(paid.json.aggregate as Record<string, unknown>);
      }
      const ev = paid.json.evidence as {
        id?: string;
        settlement?: { ref?: string };
      } | undefined;
      if (ev?.settlement?.ref) setSettlement(ev.settlement.ref);
      if (ev?.id) {
        setEvidenceId(ev.id);
        const pack = await getEvidence(ev.id);
        if (!isInvoice(pack)) {
          setEvidenceJson(JSON.stringify(pack, null, 2));
          const ref = (pack as { settlement?: { ref?: string } }).settlement?.ref;
          if (ref) setSettlement(ref);
        }
      } else if (paid.json.evidence && !isInvoice(paid.json.evidence)) {
        setEvidenceJson(JSON.stringify(paid.json.evidence, null, 2));
      }
      if (paid.status === 200) {
        setPaidOnce(true);
        openReceipt = true;
        setConfirmPay(false);
        speak(st, paid.json.aggregate as Record<string, unknown> | undefined);
      }
    } catch (err) {
      setStatus("error");
      pushTrace({ t: new Date().toISOString(), rail: "hop", msg: String(err) });
    } finally {
      setPending(false);
      closeTrace.current?.();
      closeTrace.current = null;
      if (!keepActivityOpen) {
        setRuntimeMs(Date.now() - startedAt);
        setRunStartedAt(null);
        setTraceOpen(false);
        setDrawerOpen(openReceipt);
      }
    }
  }

  function speak(st: UiStatus, agg: Record<string, unknown> | undefined) {
    if (muteTts) return;
    const text =
      query === "policy_check" ? stampLabel(chip, agg?.breached === true) : QUERY_LABELS[query];
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(`${st} ${text}`));
  }

  const wall = wallFromAggregate(aggregate, meta?.wall_buffer ?? 0.2);
  const breached = aggregate?.breached === true;
  const stamped = status === "success" || status === "reject";
  const resultStamp =
    query === "policy_check" ? stampLabel(chip, breached) : status === "reject" ? "REJECTED" : "ACCEPTED";
  const stamp = stamped ? resultStamp : "—";
  const answerDisplay = stamped
    ? stamp
    : pending
      ? "CHECKING"
      : status === "error"
        ? "TRY AGAIN"
        : "READY";
  const answerNote = stamped
    ? query === "policy_check"
      ? "Decision returned from the private check."
      : `${QUERY_LABELS[query]} returned from the selected sources.`
    : pending
      ? "Reading the live data now."
      : status === "error"
        ? "Hop could not complete this check. Review Activity and try again."
      : "Choose a question, then run the check.";
  const observed = typeof aggregate?.observed === "number" ? aggregate.observed : undefined;
  const activeChip = CHIPS.find((c) => c.id === chip) ?? CHIPS[0];
  const protocolList = body.protocols;
  const protocolOptions = meta?.protocols?.length
    ? meta.protocols.map((protocol) => ({
        key: protocol.key,
        label: sourceLabel([protocol.key]),
        configured: protocol.configured,
      }))
    : protocolList.map((key) => ({ key, label: sourceLabel([key]), configured: true }));
  const evidenceLines = receiptRows(evidenceJson);
  const sourceStatus =
    metaStatus === "loading"
      ? "Loading live sources"
      : metaStatus === "error"
        ? "Source status unavailable"
        : meta?.graph_ready
          ? "Live sources ready"
          : "Live source needs setup";
  const sourceStatusClass =
    metaStatus === "error" ? "error" : meta?.graph_ready ? "ready" : "loading";
  const joinStatus =
    metaStatus === "loading"
      ? "Checking CRE runner"
      : metaStatus === "error"
        ? "CRE status unavailable"
      : meta?.hop_join === "inline"
        ? "Inline join"
        : meta?.cre?.cli_ready === false
          ? "CRE runner unavailable"
          : "CRE runner ready";
  const joinStatusClass =
    metaStatus === "loading"
      ? "loading"
      : meta?.hop_join === "inline" || meta?.cre?.cli_ready
        ? "ready"
        : "error";
  const hasInvoice = trace.some((event) => event.rail === "hedera" && /invoice|verify|settle/i.test(event.msg));
  const hasCheck = trace.some((event) => event.rail === "cre" || event.rail === "graph");
  const hasProof =
    Boolean(evidenceId) ||
    trace.some((event) => /hcs|evidence|report/i.test(event.msg));
  const progressIndex = hasProof ? 4 : hasCheck ? 3 : hasInvoice ? 2 : runStartedAt !== null ? 1 : 0;
  const currentProgressIndex = progressIndex > 0 && progressIndex < 4 ? progressIndex - 1 : -1;
  const progressLabel =
    status === "error"
      ? "Run stopped"
      : progressIndex === 4
        ? "Complete"
        : progressIndex === 3
          ? "Checking live data"
          : progressIndex === 2
            ? "Settling payment"
            : progressIndex === 1
              ? "Starting check"
              : "Ready to run";

  const flags =
    variant === "app" ? (
      <nav className="app-trust" aria-label="what powers this check">
        <span className={rails.graph ? "on" : ""}>Market data</span>
        <span className={rails.hedera ? "on" : ""}>Payment</span>
        <span className={rails.cre ? "on" : ""}>Private check</span>
        <span className={rails.world ? "on" : ""}>Human proof</span>
      </nav>
    ) : (
      <nav className="rail" aria-label="rails">
        <span className={rails.graph ? "on" : ""}>
          <i />
          Graph
          <Info text={HELP.graph} />
        </span>
        <span className={rails.hedera ? "on" : ""}>
          <i />
          Hedera
          <Info text={HELP.hedera} />
        </span>
        <span className={rails.cre ? "on" : ""}>
          <i />
          CRE
          <Info text={HELP.cre} />
        </span>
        <span className={rails.world ? "on" : ""}>
          <i />
          World
          <Info text={HELP.worldRail} place="end" />
        </span>
      </nav>
    );

  const askBlock = (
    <section className="ask">
      <span className="ask-k">
        ask
        <Info text={HELP.ask} />
      </span>
      <button
        type="button"
        className="mic"
        onClick={() => recRef.current?.start()}
        aria-label="mic"
      >
        mic
      </button>
      <Info text={HELP.mic} />
      <button type="button" onClick={() => setTextOpen((v) => !v)}>
        text
      </button>
      {textOpen ? (
        <input value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="ask" />
      ) : (
        <p className="prompt">{ask || CHIPS[0].ask}</p>
      )}
      {variant === "desk" ? (
        <>
          <label htmlFor={`mute-${variant}`}>mute TTS</label>
          <input
            id={`mute-${variant}`}
            type="checkbox"
            checked={muteTts}
            onChange={(e) => setMuteTts(e.target.checked)}
          />
          <Info text={HELP.mute} />
        </>
      ) : null}
    </section>
  );

  const chips = (
    <section className="chips">
      {CHIPS.map((c) => (
        <span key={c.id} className="chip-item">
          <button
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
          <Info text={chipHelp(c.id)} />
        </span>
      ))}
      {paidOnce ? (
        <span className="chip-item">
          <button type="button" onClick={() => setWallOpen(true)}>
            WALL
          </button>
          <Info text={HELP.wall} />
        </span>
      ) : null}
    </section>
  );

  const stampBox = (
    <section className="stamp-box">
      <p className="stamp-k">
        stamp
        <Info text={HELP.stamp} />
      </p>
      <p className={`stamp ${stamped ? (breached ? "over" : "clear") : ""}`}>{stamp}</p>
      {stamped && observed !== undefined ? (
        <p>
          observed: {observed}
          <Info text={HELP.observed} />
        </p>
      ) : null}
      {settlement ? (
        <p>
          <a href={hashscanTx(settlement)} target="_blank" rel="noreferrer">
            HashScan
          </a>
          <Info text={HELP.hashscan} />
        </p>
      ) : null}
      {status === "pending" ||
      status === "unpaid" ||
      status === "policy_unavailable" ||
      status === "graph_unconfigured" ||
      status === "cre_unavailable" ||
      status === "facilitator_unavailable" ||
      status === "merchant_unconfigured" ||
      status === "mandate_review" ||
      status === "mandate_denied" ||
      status === "rate_limited" ||
      status === "payer_denied" ||
      status === "world_required" ||
      status === "stale" ||
      status === "k_anon_denied" ? (
        <p className="status">
          {status}
          {STATUS_HELP[status] ? <Info text={STATUS_HELP[status]} /> : null}
        </p>
      ) : null}
      {confirmPay ? (
        <span className="go-wrap">
          <button type="button" className="go" onClick={() => void runHop()}>
            confirm pay
          </button>
          <Info text={HELP.confirm} place="up" />
        </span>
      ) : (
        <span className="go-wrap">
          <button type="button" className="go" disabled={pending} onClick={() => void runHop()}>
            check
          </button>
          <Info text={HELP.check} place="up" />
        </span>
      )}
    </section>
  );

  const agent = (
    <section>
      <p className="stamp-k">
        <button type="button" onClick={() => setAgentOpen((v) => !v)}>
          agent
        </button>
        <Info text={HELP.agent} />
      </p>
      {agentOpen ? (
        <>
          {variant === "app" ? (
            <>
              <label htmlFor={`mute-${variant}`}>mute TTS</label>
              <input
                id={`mute-${variant}`}
                type="checkbox"
                checked={muteTts}
                onChange={(e) => setMuteTts(e.target.checked)}
              />
              <Info text={HELP.mute} />
            </>
          ) : null}
          <label htmlFor={`query-${variant}`}>
            query
            <Info text={HELP.query} />
          </label>
          <select
            id={`query-${variant}`}
            value={query}
            onChange={(e) => setQuery(e.target.value as QueryType)}
          >
            {QUERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUERY_LABELS[t]}
              </option>
            ))}
          </select>
          <label htmlFor={`protocols-${variant}`}>
            protocols
            <Info text={HELP.protocols} />
          </label>
          <input
            id={`protocols-${variant}`}
            value={protocols}
            onChange={(e) => setProtocols(e.target.value)}
          />
          <label htmlFor={`lag-${variant}`}>
            max_block_lag
            <Info text={HELP.lag} />
          </label>
          <input
            id={`lag-${variant}`}
            type="number"
            min={0}
            value={maxBlockLag}
            onChange={(e) => setMaxBlockLag(e.target.value)}
          />
          <label htmlFor={`xpay-${variant}`}>
            X-PAYMENT
            <Info text={HELP.xpay} />
          </label>
          <input
            id={`xpay-${variant}`}
            value={xPayment}
            onChange={(e) => setXPayment(e.target.value)}
            autoComplete="off"
          />
          {meta?.world?.ready && meta.world.app_id ? (
            <span className="chip-item">
              <WorldIdButton
                appId={meta.world.app_id}
                action={meta.world.action}
                environment={meta.world.environment}
                ok={Boolean(worldToken)}
                onToken={setWorldToken}
              />
              <Info text={HELP.world} />
            </span>
          ) : null}
        </>
      ) : null}
    </section>
  );

  const side = (
    <>
      <section className={`trace ${pending ? "live" : ""}`}>
        {variant === "app" ? (
          <p className="stamp-k">
            <button type="button" onClick={() => setTraceOpen((v) => !v)}>
              trace
            </button>
            <Info text={HELP.trace} />
          </p>
        ) : (
          <p className="stamp-k">
            trace
            <Info text={HELP.trace} />
          </p>
        )}
        {traceOpen ? (
          <pre>{trace.map((e) => `${e.t} [${e.rail}] ${e.msg}`).join("\n") || "—"}</pre>
        ) : null}
      </section>
      <aside>
        <p className="stamp-k">
          <button type="button" onClick={() => setDrawerOpen((o) => !o)}>
            Evidence
          </button>
          <Info text={HELP.evidence} />
        </p>
        {drawerOpen ? (
          <>
            <span className="chip-item">
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
              <Info text={HELP.export} />
            </span>
            <span className="chip-item">
              <button
                type="button"
                disabled={!evidenceId}
                onClick={() => {
                  void (async () => {
                    if (!evidenceId) return;
                    const pack = await getPeac(evidenceId);
                    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "peac.json";
                    a.click();
                  })();
                }}
              >
                PEAC
              </button>
              <Info text={HELP.peac} />
            </span>
            <pre>{receiptText(evidenceJson)}</pre>
          </>
        ) : null}
      </aside>
      {wallOpen ? (
        <section className="wall">
          <p>
            WALL
            <Info text={HELP.wall} />
          </p>
          <p>Is cash below our operating buffer?</p>
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
    </>
  );

  if (variant === "app") {
    return (
      <div className={`app-shell ${pending ? "busy" : ""}`}>
        <header className="app-top">
          <a
            className="app-mark"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <span>Hop</span>
            <small className="app-mark-tagline">
              Private rules. Clear decisions. Built for agents.
            </small>
          </a>
          {flags}
          <a
            className="app-link"
            href="/desk"
            onClick={(e) => {
              e.preventDefault();
              navigate("/desk");
            }}
          >
            Desk
          </a>
        </header>

        <div className="app-work">
          <div className="app-col">
            <section className="app-card">
              <p className="app-subline">Paid, private, verifiable agent decisions.</p>
              <div className="app-k-row">
                <h2 className="app-k">What should Hop check?</h2>
                <Info text={HELP.ask} />
              </div>
              <p className="app-helper">Start with a prompt, or ask in your own words.</p>
              <div className="app-prompt-grid">
                {CHIPS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`app-prompt-choice ${chip === c.id ? "on" : ""}`}
                    aria-pressed={chip === c.id}
                    onClick={() => {
                      setChip(c.id);
                      setQuery(c.query);
                      setAsk(c.ask);
                    }}
                  >
                    <span className="app-prompt-title">{c.label}</span>
                    <span className="app-prompt-copy">{c.ask}</span>
                    <span className="app-prompt-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
                {paidOnce ? (
                  <button
                    type="button"
                    className="app-prompt-choice app-prompt-secondary"
                    onClick={() => setWallOpen(true)}
                  >
                    <span className="app-prompt-title">Cash buffer</span>
                    <span className="app-prompt-copy">Check the operating buffer.</span>
                    <span className="app-prompt-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ) : null}
              </div>
              <FlowLine />
              <div className="app-input-label">
                <span>Question wording</span>
                <span>Optional · press Enter to run</span>
              </div>
              <div className="app-ask-row">
                <input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="Ask a plain-language question…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ask.trim()) void runHop();
                  }}
                  aria-label="question"
                />
                <span className="app-mic-wrap">
                  <button
                    type="button"
                    className="app-mic"
                    onClick={() => recRef.current?.start()}
                    aria-label="speak question"
                  >
                    Speak
                  </button>
                </span>
              </div>
              <div className="app-context">
                <span className={`app-context-status ${sourceStatusClass}`}>{sourceStatus}</span>
                <span className={`app-context-status ${joinStatusClass}`}>{joinStatus}</span>
                <span>Sources: {sourceLabel(protocolList)}</span>
                <span>Private limit protected</span>
                <span>Freshness: {maxBlockLag} blocks</span>
                <button
                  type="button"
                  className="app-refresh"
                  onClick={() => void refreshMeta()}
                  disabled={metaStatus === "loading"}
                >
                  {metaStatus === "loading" ? "Refreshing…" : "Refresh sources"}
                </button>
              </div>
              <p className="app-input-note">
                Supported checks only. Your wording is context; the selected check and sources run.
              </p>
              <div className="app-check-builder">
                <div className="app-builder-field">
                  <label htmlFor="check-type-main">Check type</label>
                  <select
                    id="check-type-main"
                    value={query}
                    onChange={(e) => setQuery(e.target.value as QueryType)}
                  >
                    {QUERY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUERY_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="app-builder-field">
                  <span className="app-builder-label">Data sources</span>
                  <div className="app-source-options">
                    {protocolOptions.map((protocol) => {
                      const selected = protocolList.includes(protocol.key);
                      return (
                        <button
                          key={protocol.key}
                          type="button"
                          className={`app-source-option ${selected ? "on" : ""}`}
                          aria-pressed={selected}
                          disabled={!protocol.configured}
                          onClick={() => toggleProtocol(protocol.key)}
                        >
                          {protocol.label}
                          {!protocol.configured ? " unavailable" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`app-card app-result app-result-${stamped ? (breached ? "over" : "clear") : pending ? "pending" : status === "error" ? "error" : "ready"}`}
            >
              <div className="app-output-head">
                <div>
                  <p className="app-output-eyebrow">Hop decision</p>
                  <h2 className="app-k">Your answer</h2>
                </div>
                <span
                  className={`app-output-state ${stamped ? "verified" : pending ? "live" : confirmPay ? "payment" : status === "error" ? "error" : ""}`}
                >
                  {stamped
                    ? "VERIFIED"
                    : pending
                      ? "LIVE CHECK"
                      : confirmPay
                        ? "PAYMENT READY"
                        : status === "error"
                          ? "CHECK FAILED"
                          : "READY"}
                </span>
              </div>
              <div
                className={`app-run-meter ${status === "error" ? "error" : ""}`}
                aria-label={`Run progress: ${progressLabel}. Runtime ${formatRuntime(runtimeMs)}`}
              >
                <div className="app-run-meter-meta">
                  <span>{progressLabel}</span>
                  <span>Runtime {formatRuntime(runtimeMs)}</span>
                </div>
                <div className="app-progress-bar" aria-hidden="true">
                  {RUN_STEPS.map((step, index) => {
                    const state =
                      progressIndex === 4 || index < currentProgressIndex
                        ? "done"
                        : index === currentProgressIndex
                          ? "current"
                          : "";
                    return <span key={step} className={state} />;
                  })}
                </div>
                <div className="app-progress-labels" aria-hidden="true">
                  {RUN_STEPS.map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
              </div>
              <div className="app-answer-box">
                <p className="app-output-question">{ask}</p>
                <p className="app-legend">
                  {query === "policy_check" ? `${activeChip.over} / ${activeChip.clear}` : QUERY_LABELS[query]}
                </p>
                <p
                  className={`app-stamp ${stamped ? (breached ? "over" : "clear") : pending ? "pending" : "ready"}`}
                >
                  {answerDisplay}
                </p>
                <p className="app-answer-note">{answerNote}</p>
              </div>
              <div className="app-meta-row">
                {stamped && observed !== undefined ? (
                  <span>
                    Public signal: {observed}
                  </span>
                ) : (
                  <span>Private limit protected</span>
                )}
                {settlement ? (
                  <span>
                    <a href={hashscanTx(settlement)} target="_blank" rel="noreferrer">
                      Payment record
                    </a>
                  </span>
                ) : null}
                {status === "pending" ||
                status === "unpaid" ||
                status === "policy_unavailable" ||
                status === "graph_unconfigured" ||
                status === "cre_unavailable" ||
                status === "facilitator_unavailable" ||
                status === "merchant_unconfigured" ||
                status === "mandate_review" ||
                status === "mandate_denied" ||
                status === "rate_limited" ||
                status === "payer_denied" ||
                status === "world_required" ||
                status === "stale" ||
                status === "k_anon_denied" ||
                status === "error" ? (
                  <span className="app-status">
                    {status === "error" ? "Try again" : STATUS_LABEL[status] ?? status}
                  </span>
                ) : null}
              </div>
              {confirmPay ? (
                <>
                  <span className="app-go-wrap">
                    <button type="button" className="app-go" onClick={() => void runHop()}>
                      Approve payment
                    </button>
                    <Info text={HELP.confirm} place="up" />
                  </span>
                  <span className="app-payment-note">A small Hedera payment is ready.</span>
                </>
              ) : (
                <>
                  <span className="app-go-wrap">
                    <button
                      type="button"
                      className="app-go"
                      disabled={pending || !ask.trim()}
                      onClick={() => void runHop()}
                    >
                      Run check
                    </button>
                    <Info text={HELP.check} place="up" />
                  </span>
                  <span className="app-payment-note">A small Hedera fee may be requested.</span>
                </>
              )}
            </section>

            <section className="app-card app-settings">
              <div className="app-card-h">
                <button
                  type="button"
                  className="app-disclosure"
                  onClick={() => setAgentOpen((v) => !v)}
                  aria-expanded={agentOpen}
                >
                  Advanced settings
                </button>
              </div>
              {!agentOpen ? (
                <p className="app-panel-summary">Optional controls for agents and integrations.</p>
              ) : null}
              {agentOpen ? (
                <div className="app-params">
                  <label className="app-check" htmlFor="mute-app">
                    <input
                      id="mute-app"
                      type="checkbox"
                      checked={muteTts}
                      onChange={(e) => setMuteTts(e.target.checked)}
                    />
                    Spoken result
                    <Info text={HELP.mute} />
                  </label>
                  <div className="app-field">
                    <label htmlFor="query-app">
                      Check type
                      <Info text={HELP.query} />
                    </label>
                    <select
                      id="query-app"
                      value={query}
                      onChange={(e) => setQuery(e.target.value as QueryType)}
                    >
                      {QUERY_TYPES.map((t) => (
                        <option key={t} value={t}>
                {QUERY_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="app-field">
                    <label htmlFor="protocols-app">
                      Data sources
                      <Info text={HELP.protocols} />
                    </label>
                    <input
                      id="protocols-app"
                      value={protocols}
                      onChange={(e) => setProtocols(e.target.value)}
                    />
                  </div>
                  <div className="app-field">
                    <label htmlFor="lag-app">
                      Data freshness
                      <Info text={HELP.lag} />
                    </label>
                    <input
                      id="lag-app"
                      type="number"
                      min={0}
                      value={maxBlockLag}
                      onChange={(e) => setMaxBlockLag(e.target.value)}
                    />
                  </div>
                  <div className="app-field app-field-wide">
                    <label htmlFor="xpay-app">
                      Signed payment (advanced)
                      <Info text={HELP.xpay} />
                    </label>
                    <input
                      id="xpay-app"
                      value={xPayment}
                      onChange={(e) => setXPayment(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {meta?.world?.ready && meta.world.app_id ? (
                    <div className="app-field">
                      <span className="chip-item">
                        <WorldIdButton
                          appId={meta.world.app_id}
                          action={meta.world.action}
                          environment={meta.world.environment}
                          ok={Boolean(worldToken)}
                          onToken={setWorldToken}
                        />
                        <Info text={HELP.world} />
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <div className="app-col app-col-log">
            <section
              className={`app-card app-trace ${pending ? "live" : ""} ${traceOpen ? "open" : "closed"}`}
            >
              <div className="app-card-h">
                <button
                  type="button"
                  className="app-disclosure"
                  onClick={() => setTraceOpen((v) => !v)}
                  aria-expanded={traceOpen}
                >
                  Activity
                </button>
              </div>
              {!traceOpen ? (
                <p className="app-panel-summary">
                  {pending
                    ? "Checking the live data…"
                    : trace.length
                      ? `${trace.length} steps recorded`
                      : "Opens after you run a check"}
                </p>
              ) : null}
              {traceOpen ? (
                <ol className="app-log">
                  {trace.length === 0 ? (
                    <li className="empty">—</li>
                  ) : (
                    trace.map((e, i) => (
                      <li key={`${e.t}-${i}`}>
                        <time>{shortT(e.t)}</time>
                        <span className={`rail-tag ${e.rail}`}>{e.rail}</span>
                        <span>{e.msg}</span>
                      </li>
                    ))
                  )}
                </ol>
              ) : null}
            </section>

            <section className="app-card">
              <div className="app-card-h app-receipt-head">
                <button
                  type="button"
                  className="app-disclosure"
                  onClick={() => setDrawerOpen((o) => !o)}
                  aria-expanded={drawerOpen}
                >
                  Receipt
                </button>
                {evidenceId ? (
                  <div className="app-receipt-actions">
                    <button
                      type="button"
                      className="app-ghost"
                      onClick={() => {
                        const blob = new Blob([evidenceJson], { type: "application/json" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = "evidence.json";
                        a.click();
                      }}
                    >
                      Download receipt
                    </button>
                    <button
                      type="button"
                      className="app-ghost"
                      onClick={() => {
                        void (async () => {
                          const pack = await getPeac(evidenceId);
                          const blob = new Blob([JSON.stringify(pack, null, 2)], {
                            type: "application/json",
                          });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "peac.json";
                          a.click();
                        })();
                      }}
                    >
                      Agent receipt
                    </button>
                    <button
                      type="button"
                      className="app-ghost"
                      onClick={() => {
                        void (async () => {
                          const pack = await getVerify(evidenceId);
                          pushTrace({
                            t: new Date().toISOString(),
                            rail: "hop",
                            msg: `verify ${JSON.stringify(pack)}`,
                          });
                        })();
                      }}
                    >
                      Check proof
                    </button>
                  </div>
                ) : null}
              </div>
              {!evidenceId ? (
                <p className="app-panel-summary">Your receipt appears after a completed check.</p>
              ) : !drawerOpen ? (
                <p className="app-panel-summary">Receipt ready. Open to view the details.</p>
              ) : null}
              {drawerOpen ? (
                evidenceLines.length ? (
                  <dl className="app-dl">
                    {evidenceLines.map((row) => (
                      <div key={`${row.k}-${row.v}`}>
                        <dt>{receiptLabel(row.k)}</dt>
                        <dd>{row.v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="app-empty">—</p>
                )
              ) : null}
            </section>
          </div>
        </div>

        {wallOpen ? (
          <div className="app-wall">
            <section className="app-card">
              <div className="app-k-row">
                <h2 className="app-k">WALL</h2>
                <Info text={HELP.wall} />
              </div>
              <p>Is cash below our operating buffer?</p>
              <dl className="app-dl">
                <div>
                  <dt>sleeve</dt>
                  <dd>{wall.sleeve}</dd>
                </div>
                <div>
                  <dt>buffer</dt>
                  <dd>{wall.buffer}</dd>
                </div>
                <div>
                  <dt>observed</dt>
                  <dd>{wall.observed}</dd>
                </div>
                <div>
                  <dt>ats</dt>
                  <dd>{wall.ats}</dd>
                </div>
                <div>
                  <dt>graph_pull</dt>
                  <dd>{String(wall.graph_pull)}</dd>
                </div>
                <div>
                  <dt>x402</dt>
                  <dd>{String(wall.x402)}</dd>
                </div>
              </dl>
              <button type="button" className="app-ghost" onClick={() => setWallOpen(false)}>
                close
              </button>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`screen ${pending ? "busy" : ""}`}>
      <div className="scanlines" aria-hidden="true" />
      <header>
        <h1>HOP</h1>
        <div className="badges">
          <span>{meta?.labels?.cre ?? LABELS.cre}</span>
          <span>{meta?.labels?.rails ?? LABELS.rails}</span>
          <span>{LABELS.demoGraph}</span>
          {meta?.mandate ? (
            <span>
              mandate {meta.mandate.remaining_tinybars}
              <Info text={HELP.mandate} place="end" />
            </span>
          ) : null}
        </div>
      </header>
      {flags}
      <div className="screen-body">
        <div>
          <FlowLine />
          {askBlock}
          {chips}
          {stampBox}
          {agent}
        </div>
        <div>{side}</div>
      </div>
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
