import { useEffect, useMemo, useRef, useState } from "react";
import { QUERY_TYPES, redactTrace, type AssetIntent, type QueryType } from "@hop/shared/ui";
import {
  getAssetIntents,
  getEvidence,
  getEvidenceList,
  getLiquidationState,
  getMeta,
  getPeac,
  getVerify,
  bindPassport,
  issuePassport,
  listPassports,
  openTrace,
  postQuery,
  revokePassport,
  signDemo,
  type DecisionReceipt,
  type EvidencePack,
  type LiquidationState,
  type Meta,
  type PassportRecord,
  type QueryBody,
  type VerifyPack,
} from "./api";
import { HopWordmark } from "./HopWordmark";
import { RunTheater } from "./RunTheater";
import { WorldIdButton } from "./WorldId";
import { navigate } from "./nav";

type View = "decision" | "evidence" | "infrastructure";
type RunStatus =
  | "ready"
  | "running"
  | "review"
  | "unpaid"
  | "success"
  | "reject"
  | "stale"
  | "k_anon_denied"
  | "world_required"
  | "mandate_denied"
  | "passport_denied"
  | "rate_limited"
  | "service_unavailable"
  | "error";

type Trace = { t: string; rail: string; msg: string };
type Invoice = {
  amount?: string;
  network?: string;
  asset?: string;
  payTo?: string;
  extra?: { feePayer?: string };
};

type QuotedRun = {
  body: QueryBody;
  requirement: Invoice | undefined;
  traceId: string;
  idem: string;
  mandate?: string;
  world?: string;
  passport?: string;
  did?: string;
  erc8004?: string;
};

const QUERY_LABELS: Record<QueryType, string> = {
  policy_check: "Private utilization gate",
  market_params: "Market parameters",
  position_counts: "Position count",
  liquidations: "Liquidation count",
  account_ltv: "Account LTV cohort",
};

const STATUS_COPY: Record<RunStatus, string> = {
  ready: "READY",
  running: "EXECUTING",
  review: "APPROVAL REQUIRED",
  unpaid: "PAYMENT REQUIRED",
  success: "CLEAR",
  reject: "HOLD",
  stale: "STALE DATA",
  k_anon_denied: "PRIVACY DENIED",
  world_required: "HUMAN PROOF REQUIRED",
  mandate_denied: "MANDATE DENIED",
  passport_denied: "PASSPORT DENIED",
  rate_limited: "RATE LIMITED",
  service_unavailable: "RAIL UNAVAILABLE",
  error: "RUN FAILED",
};

const NAV: { id: View; index: string; label: string }[] = [
  { id: "decision", index: "01", label: "Decision room" },
  { id: "evidence", index: "02", label: "Evidence vault" },
  { id: "infrastructure", index: "03", label: "Infrastructure" },
];

function newTraceId(): string {
  return crypto.randomUUID();
}

function shortHash(value: string | undefined, size = 8): string {
  if (!value) return "—";
  if (value.length <= size * 2 + 3) return value;
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

function shortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(11, 19);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(ms: number): string {
  if (!ms) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSignal(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) <= 1.2) return `${(value * 100).toFixed(1)}%`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatHbar(value: string | number | undefined): string {
  const tinybars = Number(value);
  if (!Number.isFinite(tinybars)) return "—";
  return `${(tinybars / 100_000_000).toFixed(6)} HBAR`;
}

function hashscanTx(ref: string): string {
  const match = ref.match(/^(.+)@(\d+)\.(\d+)$/);
  const id = match ? `${match[1]}-${match[2]}-${match[3]}` : ref.replace("@", "-");
  return `https://hashscan.io/testnet/transaction/${id}`;
}

function verifyLabel(busy: boolean, result: VerifyPack | null): string {
  if (busy) return "CHECKING";
  if (!result) return "VERIFY HASHES";
  return result.ok ? "HASHES OK" : "HASHES FAILED";
}

function VerifyBanner({
  busy,
  result,
}: {
  busy: boolean;
  result: VerifyPack | null;
}) {
  if (!busy && !result) return null;
  const ok = result?.ok === true;
  const tiers = result?.tiers;
  const hcsChip = result?.hcs_present === false
    ? "HCS SKIP"
    : tiers?.hcs_confirmed
      ? "HCS OK"
      : "HCS FAIL";
  return (
    <div className={`ops-verify ${busy ? "" : ok ? "ok" : "bad"}`}>
      <i />
      <span>{busy ? "CHECKING HASHES" : ok ? "HASH CHECK PASSED" : "HASH CHECK FAILED"}</span>
      {result && !busy ? (
        <small>
          HASHES {tiers?.recomputed ? "OK" : "FAIL"}
          {" · "}
          SETTLEMENT {tiers?.settlement_confirmed ? "OK" : "FAIL"}
          {" · "}
          {hcsChip}
          {" · "}
          CRE SIM {tiers?.cre_simulation ? "OK" : "FAIL"}
          {" · "}
          DON {tiers?.cre_don_verified ? "OK" : "—"}
        </small>
      ) : null}
    </div>
  );
}

function downloadJson(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function mapStatus(http: number, json: Record<string, unknown>): RunStatus {
  if (http === 402) return "unpaid";
  if (http === 429) return "rate_limited";
  if (http === 403 && json.error === "mandate_review") return "review";
  if (http === 403 && json.error === "world_required") return "world_required";
  if (http === 403 && String(json.error ?? "").startsWith("passport_")) return "passport_denied";
  if (http === 403 && (String(json.error ?? "").startsWith("did_") || String(json.error ?? "").startsWith("erc8004_"))) {
    return "passport_denied";
  }
  if (http === 403) return "mandate_denied";
  if (http === 503) return "service_unavailable";
  if (json.status === "stale") return "stale";
  if (json.status === "k_anon_denied") return "k_anon_denied";
  if (json.status === "reject") return "reject";
  if (http === 200) return "success";
  return "error";
}

function evidenceFrom(value: unknown): EvidencePack | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<EvidencePack>;
  return typeof row.id === "string" && typeof row.timestamp === "string"
    ? (row as EvidencePack)
    : null;
}

function decisionFrom(value: unknown): DecisionReceipt | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<DecisionReceipt>;
  return row.schema === "hop.decision.v1" && typeof row.evidence_id === "string"
    ? (row as DecisionReceipt)
    : null;
}

function railName(rail: string): string {
  return (
    {
      hop: "HOP",
      hedera: "HEDERA",
      graph: "THE GRAPH",
      cre: "CHAINLINK CRE",
      world: "WORLD ID",
    }[rail] ?? rail.toUpperCase()
  );
}

function stateForStep(
  step: "mandate" | "payment" | "data" | "private" | "proof",
  status: RunStatus,
  trace: Trace[],
  receipt: EvidencePack | null,
): "waiting" | "active" | "done" | "blocked" {
  const has = (rail: string, pattern?: RegExp) =>
    trace.some((event) => event.rail === rail && (!pattern || pattern.test(event.msg)));
  const failed = status === "error" || status === "service_unavailable" || status === "mandate_denied";

  if (step === "mandate") {
    if (status === "review" || status === "mandate_denied") return "blocked";
    if (status !== "ready") return "done";
    return "waiting";
  }
  if (step === "payment") {
    if (status === "review" || status === "unpaid") return "blocked";
    if (receipt?.settlement?.ref || has("hedera", /settle|paid|verified/i)) return "done";
    if (has("hedera") || status === "running") return "active";
    return "waiting";
  }
  if (step === "data") {
    if (receipt?.graph?.deployments?.length || has("graph")) return "done";
    if (status === "running" && has("hedera")) return "active";
    if (failed && has("graph")) return "blocked";
    return "waiting";
  }
  if (step === "private") {
    if (receipt?.cre || has("cre", /report|stamp|join|complete/i)) return "done";
    if (has("cre")) return "active";
    if (failed && has("cre")) return "blocked";
    return "waiting";
  }
  if (receipt) return "done";
  if (status === "running" && (has("cre") || has("graph"))) return "active";
  if (failed) return "blocked";
  return "waiting";
}

function stepBadge(
  step: "mandate" | "payment" | "data" | "private" | "proof",
  stepState: "waiting" | "active" | "done" | "blocked",
  receipt: EvidencePack | null,
): string {
  if (stepState === "done") return "VERIFIED";
  if (stepState === "blocked") return "ACTION";
  if (stepState === "waiting") return "WAIT";
  if (step === "private" && receipt?.cre?.mode !== "don") return "SIM";
  return "LIVE";
}

function ProofBadge({
  state,
  label,
}: {
  state: "waiting" | "active" | "done" | "blocked";
  label: string;
}) {
  return (
    <span className={`ops-proof-badge ${state}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export function CommandCenter() {
  const [view, setView] = useState<View>("decision");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaState, setMetaState] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState<QueryType>("policy_check");
  const [protocols, setProtocols] = useState<string[]>(["aave-v3", "compound-v3"]);
  const [maxBlockLag, setMaxBlockLag] = useState(50);
  const [label, setLabel] = useState("Aave + Compound utilization gate");
  const [xPayment, setXPayment] = useState("");
  const [worldToken, setWorldToken] = useState("");
  const [passportToken, setPassportToken] = useState("");
  const [agentDid, setAgentDid] = useState("");
  const [erc8004Ref, setErc8004Ref] = useState("");
  const [passports, setPassports] = useState<PassportRecord[]>([]);
  const [passportAgent, setPassportAgent] = useState("desk-agent");
  const [passportBusy, setPassportBusy] = useState(false);
  const [verifyCopied, setVerifyCopied] = useState(false);
  const [gatePrompt, setGatePrompt] = useState("");
  const [status, setStatus] = useState<RunStatus>("ready");
  const [pending, setPending] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [trace, setTrace] = useState<Trace[]>([]);
  const [receipt, setReceipt] = useState<EvidencePack | null>(null);
  const [decision, setDecision] = useState<DecisionReceipt | null>(null);
  const [aggregate, setAggregate] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<EvidencePack[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidencePack | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyPack | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [runtime, setRuntime] = useState(0);
  const [voiceInputReady, setVoiceInputReady] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [theaterOpen, setTheaterOpen] = useState(false);
  const [atsIntents, setAtsIntents] = useState<AssetIntent[]>([]);
  const [liquidation, setLiquidation] = useState<LiquidationState | null>(null);
  const closeTrace = useRef<(() => void) | null>(null);
  const quotedRun = useRef<QuotedRun | null>(null);
  const recognition = useRef<SpeechRecognition | null>(null);
  const verifyLock = useRef(false);

  const body: QueryBody = useMemo(
    () => ({
      query,
      protocols,
      max_block_lag: maxBlockLag,
    }),
    [query, protocols, maxBlockLag],
  );

  async function refreshHistory(selectId?: string) {
    setHistoryState("loading");
    try {
      const rows = await getEvidenceList(50);
      setHistory(rows);
      setHistoryState("ready");
      if (selectId) {
        const selected = rows.find((row) => row.id === selectId);
        if (selected) setSelectedEvidence(selected);
      }
    } catch {
      setHistoryState("error");
    }
  }

  async function refreshMeta() {
    setMetaState("loading");
    try {
      const next = await getMeta();
      setMeta(next);
      const configured = next.protocols.filter((item) => item.configured).map((item) => item.key);
      if (configured.length) setProtocols(configured.slice(0, 2));
      setMetaState("ready");
    } catch {
      setMetaState("error");
    }
  }

  useEffect(() => {
    void refreshMeta();
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (view !== "infrastructure" && !wallOpen) return;
    void getAssetIntents(50).then(setAtsIntents).catch(() => setAtsIntents([]));
    void getLiquidationState().then(setLiquidation).catch(() => setLiquidation(null));
    void listPassports()
      .then((row) => setPassports(row.items))
      .catch(() => setPassports([]));
  }, [view, wallOpen]);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setRuntime(Date.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    const browser = window as unknown as {
      SpeechRecognition?: { new (): SpeechRecognition };
      webkitSpeechRecognition?: { new (): SpeechRecognition };
    };
    const Ctor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Ctor) return;
    const instance = new Ctor();
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setLabel(transcript);
    };
    recognition.current = instance;
    setVoiceInputReady(true);
  }, []);

  useEffect(
    () => () => {
      closeTrace.current?.();
    },
    [],
  );

  function pushTrace(event: Trace) {
    setTrace((current) => [...current, { ...event, msg: redactTrace(event.msg) }]);
  }

  function applyTrace(events: Trace[]) {
    setTrace(events.map((event) => ({ ...event, msg: redactTrace(event.msg) })));
  }

  function toggleProtocol(key: string) {
    setProtocols((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return current.length >= 2 ? current : [...current, key];
    });
  }

  function speakResult(nextStatus: RunStatus) {
    if (!voiceOutput || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(
      new SpeechSynthesisUtterance(nextStatus === "reject" ? "Hold" : "Clear"),
    );
  }

  async function completeResult(result: {
    status: number;
    json: Record<string, unknown>;
  }): Promise<EvidencePack | null> {
    const nextStatus = mapStatus(result.status, result.json);
    setStatus(nextStatus);
    const nextAggregate =
      result.json.aggregate && typeof result.json.aggregate === "object"
        ? (result.json.aggregate as Record<string, unknown>)
        : null;
    setAggregate(nextAggregate);
    setGatePrompt(typeof result.json.consumer_prompt === "string" ? result.json.consumer_prompt : "");

    const embedded = evidenceFrom(result.json.evidence);
    if (!embedded) {
      if (nextStatus === "review" || nextStatus === "mandate_denied" || nextStatus === "passport_denied") {
        await refreshMeta();
      }
      return null;
    }
    const fromQuery = decisionFrom(result.json.receipt);
    if (fromQuery) setDecision(fromQuery);
    let pack = embedded;
    try {
      pack = await getEvidence(embedded.id);
    } catch {
      // The response already contains the complete public evidence pack.
    }
    setReceipt(pack);
    setSelectedEvidence(pack);
    setInvoice(null);
    quotedRun.current = null;
    speakResult(nextStatus);
    await refreshHistory(pack.id);
    await refreshMeta();
    return pack;
  }

  async function payQuoted(run: QuotedRun, confirmed: boolean) {
    let payment = xPayment.trim();
    if (!payment && meta?.demo_sign) {
      payment = await signDemo(run.requirement);
    }
    if (!payment) {
      setStatus("unpaid");
      return;
    }

    const paid = await postQuery(run.body, {
      payment,
      idem: run.idem,
      traceId: run.traceId,
      mandate: run.mandate,
      world: run.world,
      passport: run.passport,
      did: run.did,
      erc8004: run.erc8004,
      confirm: confirmed,
    });
    if (Array.isArray(paid.json.trace)) applyTrace(paid.json.trace as Trace[]);
    await completeResult(paid);
  }

  async function runDecision() {
    if (pending || protocols.length === 0 || metaState !== "ready") return;
    quotedRun.current = null;
    setPending(true);
    setStatus("running");
    setTheaterOpen(true);
    setReceipt(null);
    setDecision(null);
    setSelectedEvidence(null);
    setVerifyResult(null);
    setAggregate(null);
    setTrace([]);
    setRuntime(0);
    const start = Date.now();
    setStartedAt(start);
    const traceId = newTraceId();
    const idem = crypto.randomUUID();
    closeTrace.current?.();
    closeTrace.current = openTrace(traceId, pushTrace);

    const mandate = meta?.mandate?.template
      ? JSON.stringify(meta.mandate.template)
      : undefined;
    const needApproval =
      (meta?.mandate?.human_threshold_tinybars ?? 0) > 0 ||
      Boolean(meta?.demo_sign && !xPayment.trim());

    try {
      const quote = await postQuery(body, {
        traceId,
        mandate,
        world: worldToken || undefined,
        passport: passportToken || undefined,
        did: agentDid.trim() || undefined,
        erc8004: erc8004Ref.trim() || undefined,
      });

      if (Array.isArray(quote.json.trace)) applyTrace(quote.json.trace as Trace[]);
      if (quote.status !== 402) {
        await completeResult(quote);
        return;
      }

      const requirement = (quote.json.accepts as Invoice[] | undefined)?.[0];
      setInvoice(requirement ?? null);
      pushTrace({
        t: new Date().toISOString(),
        rail: "hedera",
        msg: `x402 quote ${requirement?.amount ?? meta?.amount ?? "—"} tinybars`,
      });

      const run: QuotedRun = {
        body: { ...body, protocols: [...body.protocols] },
        requirement,
        traceId,
        idem,
        mandate,
        world: worldToken || undefined,
        passport: passportToken || undefined,
        did: agentDid.trim() || undefined,
        erc8004: erc8004Ref.trim() || undefined,
      };

      if (needApproval) {
        quotedRun.current = run;
        setStatus("review");
        return;
      }

      await payQuoted(run, false);
    } catch (error) {
      setStatus("error");
      pushTrace({
        t: new Date().toISOString(),
        rail: "hop",
        msg: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPending(false);
      setRuntime(Date.now() - start);
      setStartedAt(null);
      closeTrace.current?.();
      closeTrace.current = null;
    }
  }

  async function approveDecision() {
    const run = quotedRun.current;
    if (!run || pending) return;
    setPending(true);
    setStatus("running");
    setTheaterOpen(true);
    setTrace([]);
    const start = Date.now();
    setStartedAt(start);
    closeTrace.current?.();
    closeTrace.current = openTrace(run.traceId, pushTrace);
    try {
      await payQuoted(run, true);
    } catch (error) {
      setStatus("error");
      pushTrace({
        t: new Date().toISOString(),
        rail: "hop",
        msg: error instanceof Error ? error.message : String(error),
      });
    } finally {
      quotedRun.current = null;
      setPending(false);
      setRuntime(Date.now() - start);
      setStartedAt(null);
      closeTrace.current?.();
      closeTrace.current = null;
    }
  }

  async function openEvidence(row: EvidencePack) {
    setSelectedEvidence(row);
    setVerifyResult((current) => (current && row.id === selectedEvidence?.id ? current : null));
    try {
      setSelectedEvidence(await getEvidence(row.id));
    } catch {
      setSelectedEvidence(row);
    }
  }

  async function verifyEvidence(row: EvidencePack) {
    if (verifyLock.current || !row.id) return;
    verifyLock.current = true;
    setVerifyBusy(true);
    try {
      const pack = await getVerify(row.id);
      setVerifyResult(pack);
      const next = decisionFrom(pack.receipt);
      if (next) setDecision(next);
    } catch {
      setVerifyResult({ ok: false });
    } finally {
      verifyLock.current = false;
      setVerifyBusy(false);
    }
  }

  const activeEvidence = view === "evidence" ? selectedEvidence : receipt;
  const controlsLocked = pending || status === "review";
  const observed = aggregate?.observed ?? activeEvidence?.reason?.observed;
  const graphReady = Boolean(meta?.graph_configured ?? meta?.graph_ready);
  const creReady = Boolean(meta?.cre?.join === "cre" && meta.cre.cli_ready);
  const hederaReady = Boolean(meta?.payTo && meta?.network === "hedera:testnet");
  const configuredCount = meta?.protocols.filter((item) => item.configured).length ?? 0;
  const verdict =
    decision?.decision.verdict ??
    receipt?.verdict ??
    (status === "success" && aggregate?.breached === true
      ? "HOLD"
      : status === "success"
        ? query === "policy_check"
          ? "ALLOW"
          : "ALLOW"
        : status === "reject"
          ? "HOLD"
          : STATUS_COPY[status]);

  const steps = [
    {
      id: "mandate" as const,
      index: "01",
      rail: "POLICY",
      title: "Agent mandate",
      value: meta?.mandate ? `${meta.mandate.remaining_hops} calls remaining` : "Optional",
    },
    {
      id: "payment" as const,
      index: "02",
      rail: "HEDERA",
      title: "Exact x402 payment",
      value: formatHbar(invoice?.amount ?? meta?.amount),
    },
    {
      id: "private" as const,
      index: "03",
      rail: "CHAINLINK",
      title: "CRE confidential workflow",
      value:
        receipt?.cre?.mode === "don"
          ? "handlerInTee · Nitro · DON"
          : "handlerInTee · Nitro · simulation",
    },
    {
      id: "data" as const,
      index: "04",
      rail: "THE GRAPH",
      title: "Standardized Graph join",
      value: receipt
        ? `${receipt.graph.deployments.length} public snapshots`
        : `${protocols.length} selected subgraphs`,
    },
    {
      id: "proof" as const,
      index: "05",
      rail: "EVIDENCE",
      title: "Verifiable receipt",
      value:
        receipt?.hcs_seq != null
          ? `HCS seq ${receipt.hcs_seq}`
          : meta?.hcs?.ready
            ? "HCS optional"
            : "Hash chain",
    },
  ];

  return (
    <div className={`ops-shell ${pending ? "is-running" : ""}`}>
      <aside className="ops-sidebar">
        <a
          className="ops-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <span>
            <HopWordmark />
            <small>DECISION API</small>
          </span>
        </a>

        <div className="ops-tenant">
          <span>WORKSPACE</span>
          <strong>Testnet operator</strong>
          <small>Hedera x402 · Graph · CRE sim</small>
        </div>

        <nav className="ops-nav" aria-label="Product views">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.index}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ops-side-proof">
          <span className="ops-side-label">RAIL CONFIG</span>
          <ProofBadge state={graphReady ? "done" : "blocked"} label="The Graph" />
          <ProofBadge state={creReady ? "done" : "blocked"} label="Chainlink CRE" />
          <ProofBadge state={hederaReady ? "done" : "blocked"} label="Hedera x402" />
        </div>

        <div className="ops-sidebar-foot">
          <a href="/docs">Docs</a>
          <a href="/openapi.yaml">OpenAPI</a>
          <a href="/SKILL.md">Agent skill</a>
          <a href="/swagger.html">Swagger</a>
          <button
            type="button"
            onClick={() => navigate("/assets")}
          >
            ATS studio
          </button>
        </div>
      </aside>

      <main className="ops-main">
        {view === "decision" ? (
          <div className="ops-page ops-decision-page">
            <div className="ops-page-head">
              <div>
                <h1>Decision room</h1>
              </div>
              <div className="ops-head-meta">
                <span className="ops-network">{meta?.network ?? "hedera:testnet"}</span>
                <div className="ops-run-meta">
                  <span>RUN TIME</span>
                  <strong>{formatDuration(runtime)}</strong>
                </div>
              </div>
            </div>

            <section className="ops-stat-strip" aria-label="Runtime posture">
              <div>
                <span>POLICY INPUT</span>
                <strong>CONFIGURED</strong>
                <small>Policy values omitted · hash returned</small>
              </div>
              <div>
                <span>DATA SOURCES</span>
                <strong>{configuredCount}/{meta?.protocols.length ?? 2}</strong>
                <small>configured · Messari {meta?.schemaVersion ?? "3.1.0"}</small>
              </div>
              <div>
                <span>AGENT BUDGET</span>
                <strong>{formatHbar(meta?.mandate?.remaining_tinybars)}</strong>
                <small>{meta?.mandate?.remaining_hops ?? "—"} calls available</small>
              </div>
              <div>
                <span>EVIDENCE</span>
                <strong>{receipt?.hcs_seq != null ? "HCS" : "CHAINED"}</strong>
                <small>
                  {receipt?.hcs_seq != null
                    ? `seq ${receipt.hcs_seq}`
                    : meta?.hcs?.topic
                      ? "HCS optional"
                      : "SHA-256"}
                </small>
              </div>
            </section>

            <div className="ops-run-grid">
              <section className="ops-panel ops-request">
                <div className="ops-panel-head">
                  <span>DECISION REQUEST</span>
                  <span className="ops-panel-index">01</span>
                </div>

                <label className="ops-field">
                  <span>REQUEST LABEL</span>
                  <div className="ops-input-with-action">
                    <input
                      value={label}
                      disabled={controlsLocked}
                      onChange={(event) => setLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void runDecision();
                      }}
                    />
                    {voiceInputReady ? (
                      <button type="button" disabled={controlsLocked} onClick={() => recognition.current?.start()}>
                        VOICE
                      </button>
                    ) : null}
                  </div>
                  <small>Display label only · execution is deterministic</small>
                </label>

                <div className="ops-field">
                  <span>CHECK</span>
                  <div className="ops-selected-check">
                    <i aria-hidden="true">P</i>
                    <div>
                      <strong>{QUERY_LABELS[query]}</strong>
                      <small>utilization · scope: all · threshold: private</small>
                    </div>
                    <span>LOCKED</span>
                  </div>
                </div>

                <div className="ops-field">
                  <span>STANDARDIZED SOURCES</span>
                  <div className="ops-source-list">
                    {(meta?.protocols ?? []).map((protocol) => {
                      const selected = protocols.includes(protocol.key);
                      return (
                        <button
                          key={protocol.key}
                          type="button"
                          className={selected ? "selected" : ""}
                      disabled={!protocol.configured || controlsLocked}
                          onClick={() => toggleProtocol(protocol.key)}
                        >
                          <i aria-hidden="true" />
                          <span>
                            <strong>{protocol.key.replaceAll("-", " ").toUpperCase()}</strong>
                            <small>{protocol.configured ? "CONFIGURED · ETHEREUM" : "UNAVAILABLE"}</small>
                          </span>
                          <b>{selected ? "ON" : "OFF"}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <details className="ops-advanced">
                  <summary>Runtime controls</summary>
                  <div className="ops-control-grid">
                    <label>
                      <span>Query type</span>
                      <select disabled={controlsLocked} value={query} onChange={(event) => setQuery(event.target.value as QueryType)}>
                        {QUERY_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {QUERY_LABELS[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Max block lag</span>
                      <input
                        type="number"
                        min={0}
                        disabled={controlsLocked}
                        value={maxBlockLag}
                        onChange={(event) => setMaxBlockLag(Number(event.target.value) || 0)}
                      />
                    </label>
                    <label className="wide">
                      <span>Signed X-PAYMENT</span>
                      <input
                        value={xPayment}
                        disabled={controlsLocked}
                        onChange={(event) => setXPayment(event.target.value)}
                        autoComplete="off"
                        placeholder={meta?.demo_sign ? "Demo signer enabled" : "Required for paid retry"}
                      />
                    </label>
                    <label className="ops-toggle wide">
                      <input
                        type="checkbox"
                        checked={voiceOutput}
                        disabled={controlsLocked}
                        onChange={(event) => setVoiceOutput(event.target.checked)}
                      />
                      <span>Voice verdict</span>
                    </label>
                    {meta?.world?.ready && meta.world.app_id ? (
                      <div className="wide">
                        <WorldIdButton
                          appId={meta.world.app_id}
                          action={meta.world.action}
                          environment={meta.world.environment}
                          ok={Boolean(worldToken)}
                          onToken={setWorldToken}
                        />
                      </div>
                    ) : null}
                    <label className="wide">
                      <span>X-Hop-Passport</span>
                      <input
                        value={passportToken}
                        disabled={controlsLocked}
                        onChange={(event) => setPassportToken(event.target.value)}
                        autoComplete="off"
                        placeholder={meta?.identity?.ready ? "Optional unless required" : "Identity unconfigured"}
                      />
                    </label>
                    <label className="wide">
                      <span>X-Hop-Did</span>
                      <input
                        value={agentDid}
                        disabled={controlsLocked}
                        onChange={(event) => setAgentDid(event.target.value)}
                        autoComplete="off"
                        placeholder="did:web:… optional"
                      />
                    </label>
                    <label className="wide">
                      <span>X-Hop-Erc8004</span>
                      <input
                        value={erc8004Ref}
                        disabled={controlsLocked}
                        onChange={(event) => setErc8004Ref(event.target.value)}
                        autoComplete="off"
                        placeholder="agentId;eip155:chain:registry"
                      />
                    </label>
                  </div>
                </details>
              </section>

              <section className="ops-panel ops-pipeline">
                <div className="ops-panel-head">
                  <span>LIVE EXECUTION</span>
                  <span className="ops-panel-index">02</span>
                </div>
                <ol className="ops-steps">
                  {steps.map((step) => {
                    const stepState = stateForStep(step.id, status, trace, receipt);
                    return (
                      <li key={step.id} className={stepState}>
                        <span className="ops-step-index">{step.index}</span>
                        <span className="ops-step-line" aria-hidden="true">
                          <i />
                        </span>
                        <div>
                          <small>{step.rail}</small>
                          <strong>{step.title}</strong>
                          <span>{step.value}</span>
                        </div>
                        <b>{stepBadge(step.id, stepState, receipt)}</b>
                      </li>
                    );
                  })}
                </ol>
                <div className="ops-live-terminal">
                  <div>
                    <span>EXECUTION TRACE</span>
                    <b>{trace.length} EVENTS</b>
                    <button
                      type="button"
                      onClick={() => setTheaterOpen(true)}
                      disabled={!pending && trace.length === 0 && !receipt}
                    >
                      LIVE HOP
                    </button>
                  </div>
                  <p>
                    {trace.length
                      ? `[${railName(trace[trace.length - 1].rail)}] ${trace[trace.length - 1].msg}`
                      : "Awaiting request"}
                  </p>
                </div>
              </section>

              <section className={`ops-panel ops-verdict status-${status}`}>
                <div className="ops-panel-head">
                  <span>POLICY VERDICT</span>
                  <span className="ops-panel-index">03</span>
                </div>
                <div className="ops-verdict-core" aria-live="polite" aria-atomic="true">
                  <span className="ops-verdict-state">
                    <i aria-hidden="true" />
                    {STATUS_COPY[status]}
                  </span>
                  <strong>{verdict}</strong>
                  <small>{label}</small>
                </div>

                <dl className="ops-verdict-data">
                  <div>
                    <dt>PUBLIC SIGNAL</dt>
                    <dd>{formatSignal(observed)}</dd>
                  </div>
                  <div>
                    <dt>PRIVATE LIMIT</dt>
                    <dd>••••••••</dd>
                  </div>
                  <div>
                    <dt>POLICY PROOF</dt>
                    <dd>{shortHash(receipt?.policy?.threshold_hash)}</dd>
                  </div>
                  <div>
                    <dt>SETTLEMENT</dt>
                    <dd>{shortHash(receipt?.settlement?.ref)}</dd>
                  </div>
                  <div>
                    <dt>RECEIPT</dt>
                    <dd>{decision?.schema ?? (receipt ? "hop.decision.v1" : "—")}</dd>
                  </div>
                  <div>
                    <dt>CHARGE</dt>
                    <dd>
                      {decision
                        ? decision.charge.settled
                          ? `${decision.decision.verdict} · ${decision.decision.reason_code}`
                          : "REPLAY"
                        : receipt
                          ? receipt.verdict ?? "ATTEMPT"
                          : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>SCREENING</dt>
                    <dd>
                      {(decision?.screening ?? receipt?.screening)?.ofac ?? "not_screened"}
                    </dd>
                  </div>
                </dl>

                {status === "review" ? (
                  <>
                    {gatePrompt ? <p className="ops-gate-prompt">{gatePrompt}</p> : null}
                    <p className="ops-gate-remaining">
                      {formatHbar(meta?.mandate?.remaining_tinybars)} · {meta?.mandate?.remaining_hops ?? "—"} CALLS
                    </p>
                    <button
                    type="button"
                    className="ops-primary ops-approve"
                    onClick={() => void approveDecision()}
                  >
                    <span>APPROVE {formatHbar(invoice?.amount ?? meta?.amount)}</span>
                    <b>→</b>
                  </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ops-primary"
                    disabled={pending || protocols.length === 0 || metaState !== "ready"}
                    onClick={() => void runDecision()}
                  >
                    <span>{pending ? "EXECUTING LIVE RAILS" : receipt ? "RUN NEW DECISION" : "RUN LIVE DECISION"}</span>
                    <b>{pending ? "•••" : "→"}</b>
                  </button>
                )}

                <div className="ops-cost-line">
                  <span>PRICE</span>
                  <strong>{formatHbar(invoice?.amount ?? meta?.amount)}</strong>
                  <span>EXACT · TESTNET</span>
                </div>

                {receipt ? (
                  <>
                    <div className="ops-proof-actions">
                      <button type="button" onClick={() => downloadJson("hop-evidence.json", receipt)}>
                        EXPORT
                      </button>
                      {decision ? (
                        <button type="button" onClick={() => downloadJson("hop-decision.json", decision)}>
                          RECEIPT
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={verifyResult ? (verifyResult.ok ? "is-ok" : "is-bad") : ""}
                        disabled={verifyBusy}
                        onClick={() => void verifyEvidence(receipt)}
                      >
                        {verifyLabel(verifyBusy, verifyResult)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setView("evidence");
                          void openEvidence(receipt);
                        }}
                      >
                        OPEN EVIDENCE
                      </button>
                      <a href={hashscanTx(receipt.settlement.ref)} target="_blank" rel="noreferrer">
                        HASHSCAN ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/verify/${receipt.id}`;
                          void navigator.clipboard.writeText(url).then(() => {
                            setVerifyCopied(true);
                            window.setTimeout(() => setVerifyCopied(false), 1500);
                          });
                          navigate(`/verify/${receipt.id}`);
                        }}
                      >
                        {verifyCopied ? "COPIED" : "VERIFY LINK"}
                      </button>
                      <button type="button" onClick={() => setWallOpen(true)}>
                        ATS
                      </button>
                    </div>
                    <VerifyBanner busy={verifyBusy} result={verifyResult} />
                  </>
                ) : null}
              </section>
            </div>

            <section className="ops-panel ops-activity">
              <div className="ops-panel-head">
                <span>EVENT STREAM</span>
                <span className="ops-panel-index">{trace.length.toString().padStart(2, "0")}</span>
              </div>
              {trace.length ? (
                <ol>
                  {trace.map((event, index) => (
                    <li key={`${event.t}-${index}`}>
                      <time>{shortTime(event.t)}</time>
                      <span className={`ops-rail-tag ${event.rail}`}>{railName(event.rail)}</span>
                      <p>{event.msg}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="ops-empty-stream">
                  <span>NO ACTIVE RUN</span>
                  <i />
                </div>
              )}
            </section>
          </div>
        ) : null}

        {view === "evidence" ? (
          <div className="ops-page">
            <div className="ops-page-head">
              <div>
                <span className="ops-eyebrow">TAMPER-EVIDENT RECORDS</span>
                <h1>Evidence vault</h1>
              </div>
              <div className="ops-head-meta">
                <span className="ops-network">{meta?.network ?? "hedera:testnet"}</span>
                <button type="button" className="ops-secondary" onClick={() => void refreshHistory()}>
                  REFRESH
                </button>
              </div>
            </div>

            <div className="ops-vault-grid">
              <section className="ops-panel ops-history">
                <div className="ops-panel-head">
                  <span>RECENT DECISIONS</span>
                  <span className="ops-panel-index">{history.length.toString().padStart(2, "0")}</span>
                </div>
                <div className="ops-table-head">
                  <span>TIME</span>
                  <span>DECISION</span>
                  <span>QUERY</span>
                  <span>SETTLEMENT</span>
                </div>
                <div className="ops-table-body">
                  {historyState === "loading" ? <p className="ops-table-empty">LOADING</p> : null}
                  {historyState === "error" ? <p className="ops-table-empty">VAULT UNAVAILABLE</p> : null}
                  {historyState === "ready" && history.length === 0 ? (
                    <p className="ops-table-empty">NO EVIDENCE RECORDS</p>
                  ) : null}
                  {history.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={selectedEvidence?.id === row.id ? "selected" : ""}
                      onClick={() => void openEvidence(row)}
                    >
                      <time>{formatDate(row.timestamp)}</time>
                      <span className={`ops-decision-chip ${row.status}`}>{row.status.toUpperCase()}</span>
                      <span>{QUERY_LABELS[row.query.type]}</span>
                      <code>{shortHash(row.settlement.ref, 6)}</code>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ops-panel ops-evidence-detail">
                <div className="ops-panel-head">
                  <span>EVIDENCE PACK</span>
                  <span className="ops-panel-index">PEAC</span>
                </div>
                {selectedEvidence ? (
                  <>
                    <div className="ops-evidence-title">
                      <div>
                        <span className={`ops-decision-chip ${selectedEvidence.status}`}>
                          {selectedEvidence.status.toUpperCase()}
                        </span>
                        <h2>{QUERY_LABELS[selectedEvidence.query.type]}</h2>
                      </div>
                      <code>{selectedEvidence.id}</code>
                    </div>
                    <div className="ops-evidence-actions">
                      <button
                        type="button"
                        onClick={() => downloadJson(`${selectedEvidence.id}.json`, selectedEvidence)}
                      >
                        DOWNLOAD JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            const peac = await getPeac(selectedEvidence.id);
                            downloadJson(`${selectedEvidence.id}.peac.json`, peac);
                          })();
                        }}
                      >
                        EXPORT PEAC
                      </button>
                      <button
                        type="button"
                        className={verifyResult ? (verifyResult.ok ? "is-ok" : "is-bad") : ""}
                        disabled={verifyBusy}
                        onClick={() => void verifyEvidence(selectedEvidence)}
                      >
                        {verifyLabel(verifyBusy, verifyResult)}
                      </button>
                      <a href={hashscanTx(selectedEvidence.settlement.ref)} target="_blank" rel="noreferrer">
                        HASHSCAN ↗
                      </a>
                      <a href={`/verify/${selectedEvidence.id}`}>
                        PUBLIC VERIFY
                      </a>
                    </div>
                    <VerifyBanner busy={verifyBusy} result={verifyResult} />
                    <dl className="ops-evidence-dl">
                      <div>
                        <dt>Timestamp</dt>
                        <dd>{selectedEvidence.timestamp}</dd>
                      </div>
                      <div>
                        <dt>Policy hash</dt>
                        <dd>{selectedEvidence.policy.threshold_hash}</dd>
                      </div>
                      <div>
                        <dt>Aggregate hash</dt>
                        <dd>{selectedEvidence.aggregate_hash}</dd>
                      </div>
                      <div>
                        <dt>CRE commitment</dt>
                        <dd>{selectedEvidence.cre?.cre_commitment_hash ?? selectedEvidence.cre?.report_hash ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Receipt chain</dt>
                        <dd>{selectedEvidence.chain?.hash ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>CRE mode</dt>
                        <dd>{selectedEvidence.cre?.mode ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>DON execution</dt>
                        <dd>{selectedEvidence.cre?.execution_id ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Receipt</dt>
                        <dd>{verifyResult?.receipt?.schema ?? decision?.schema ?? "hop.decision.v1"}</dd>
                      </div>
                      <div>
                        <dt>Settlement</dt>
                        <dd>{verifyResult?.external_settlement_verified ? "MIRROR OK" : selectedEvidence.settlement.ref ? "HASHSCAN" : "—"}</dd>
                      </div>
                      <div>
                        <dt>HCS sequence</dt>
                        <dd>{selectedEvidence.hcs_seq ?? "Not anchored"}</dd>
                      </div>
                      <div>
                        <dt>Meter</dt>
                        <dd>
                          {selectedEvidence.meter
                            ? `${formatHbar(selectedEvidence.meter.amount)} · ${selectedEvidence.meter.protocols} protocol${selectedEvidence.meter.protocols === 1 ? "" : "s"}`
                            : "—"}
                        </dd>
                      </div>
                    </dl>

                    <div className="ops-deployments">
                      <span>GRAPH SOURCES</span>
                      {(selectedEvidence.graph?.deployments ?? []).map((deployment) => (
                        <div key={deployment.subgraphId ?? deployment.id}>
                          <strong>{deployment.slug ?? "Messari lending"}</strong>
                          <span>schema {deployment.schemaVersion}</span>
                          <span>method {deployment.methodologyVersion ?? "—"}</span>
                          <span>block {deployment.block ?? "—"}</span>
                          <span>ts {deployment.blockTimestamp ?? "—"}</span>
                          <span>subgraph {shortHash(deployment.subgraphId ?? deployment.id, 8)}</span>
                          {deployment.deploymentId ? (
                            <span>deployment {shortHash(deployment.deploymentId, 8)}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="ops-evidence-empty">
                    <span>SELECT A DECISION</span>
                    <small>Public hashes · no private policy values</small>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {view === "infrastructure" ? (
          <div className="ops-page">
            <div className="ops-page-head">
              <div>
                <span className="ops-eyebrow">RUNTIME POSTURE</span>
                <h1>Infrastructure</h1>
              </div>
              <div className="ops-head-meta">
                <span className="ops-network">{meta?.version ?? "0.1.0"}</span>
                <span className="ops-network">{meta?.status ?? "sunset"}</span>
                <span className="ops-network">{meta?.network ?? "hedera:testnet"}</span>
                <button type="button" className="ops-secondary" onClick={() => void refreshMeta()}>
                  RECHECK RAILS
                </button>
              </div>
            </div>

            <section className="ops-infra-hero">
              <div>
                <span>CONFIGURED RAILS</span>
                <strong>{[graphReady, creReady, hederaReady].filter(Boolean).length}/3</strong>
              </div>
              <div className="ops-infra-route" aria-label="Execution architecture">
                <span>AGENT</span>
                <i>→</i>
                <span>HEDERA x402</span>
                <i>→</i>
                <span>CRE WORKFLOW</span>
                <i>→</i>
                <span>GRAPH</span>
                <i>→</i>
                <span>EVIDENCE</span>
              </div>
            </section>

            <div className="ops-infra-grid">
              <article className={`ops-infra-card ${graphReady ? "ready" : "blocked"}`}>
                <div className="ops-infra-card-head">
                  <span>01 · DATA</span>
                  <ProofBadge state={graphReady ? "done" : "blocked"} label={graphReady ? "READY" : "SETUP"} />
                </div>
                <h2>The Graph</h2>
                <strong>Messari Lending 3.1.0</strong>
                <dl>
                  <div><dt>Schema</dt><dd>Messari {meta?.schemaVersion ?? "3.1.0"}</dd></div>
                  <div><dt>Composition</dt><dd>{configuredCount} protocols</dd></div>
                  <div><dt>Network</dt><dd>Ethereum</dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${creReady ? "ready" : "blocked"}`}>
                <div className="ops-infra-card-head">
                  <span>02 · PRIVATE COMPUTE</span>
                  <ProofBadge state={creReady ? "done" : "blocked"} label={creReady ? "READY" : "SETUP"} />
                </div>
                <h2>Chainlink CRE</h2>
                <strong>CRE confidential workflow</strong>
                <dl>
                  <div><dt>Handler</dt><dd>handlerInTee</dd></div>
                  <div><dt>TEE</dt><dd>{meta?.cre?.tee ?? "Nitro"}</dd></div>
                  <div><dt>Result mode</dt><dd>{meta?.cre?.execution === "don_verified" ? "DON verified" : "Simulation"}</dd></div>
                  <div><dt>DON trigger</dt><dd>{meta?.cre?.don_trigger_configured ? "Configured" : "Off"}</dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${hederaReady ? "ready" : "blocked"}`}>
                <div className="ops-infra-card-head">
                  <span>03 · SETTLEMENT</span>
                  <ProofBadge state={hederaReady ? "done" : "blocked"} label={hederaReady ? "READY" : "SETUP"} />
                </div>
                <h2>Hedera</h2>
                <strong>Blocky402 exact</strong>
                <dl>
                  <div><dt>Network</dt><dd>{meta?.network ?? "hedera:testnet"}</dd></div>
                  <div><dt>Asset</dt><dd>{meta?.asset === "0.0.0" ? "HBAR 0.0.0" : meta?.asset ?? "—"}</dd></div>
                  <div><dt>Base</dt><dd>{formatHbar(meta?.amount)}</dd></div>
                  <div><dt>Extra protocol</dt><dd>{formatHbar(meta?.meter_per_protocol)}</dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${meta?.hcs?.ready ? "ready" : "optional"}`}>
                <div className="ops-infra-card-head">
                  <span>04 · AUDIT</span>
                  <ProofBadge state={meta?.hcs?.ready ? "done" : "waiting"} label={meta?.hcs?.ready ? "READY" : "OPTIONAL"} />
                </div>
                <h2>HCS</h2>
                <strong>Evidence commitments</strong>
                <dl>
                  <div><dt>Topic</dt><dd>{shortHash(meta?.hcs?.topic ?? undefined)}</dd></div>
                  <div><dt>Auto topic</dt><dd>{meta?.hcs?.auto ? "Enabled" : "Disabled"}</dd></div>
                  <div><dt>Local chain</dt><dd>SHA-256</dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${meta?.world?.ready ? "ready" : "optional"}`}>
                <div className="ops-infra-card-head">
                  <span>05 · IDENTITY</span>
                  <ProofBadge state={meta?.world?.ready ? "done" : "waiting"} label={meta?.world?.ready ? "READY" : "OPTIONAL"} />
                </div>
                <h2>World ID</h2>
                <strong>Unique-human gate</strong>
                <dl>
                  <div><dt>Required</dt><dd>{meta?.world?.required ? "Yes" : "No"}</dd></div>
                  <div><dt>Environment</dt><dd>{meta?.world?.environment ?? "staging"}</dd></div>
                  <div><dt>Stored proof</dt><dd>Nullifier hash</dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${meta?.identity?.ready ? "ready" : "optional"}`}>
                <div className="ops-infra-card-head">
                  <span>05B · PASSPORT</span>
                  <ProofBadge
                    state={meta?.identity?.ready ? "done" : "waiting"}
                    label={meta?.identity?.required ? "REQUIRED" : meta?.identity?.ready ? "READY" : "UNCONFIGURED"}
                  />
                </div>
                <h2>Agent passport</h2>
                <strong>{passportToken ? "TOKEN HELD" : `${passports.filter((row) => row.status === "active").length} ACTIVE`}</strong>
                <dl>
                  <div><dt>Header</dt><dd>X-Hop-Passport</dd></div>
                  <div><dt>DID</dt><dd>{agentDid.trim() || passports[0]?.did || "NONE"}</dd></div>
                  <div><dt>ERC-8004</dt><dd>{erc8004Ref.trim() || (passports[0]?.erc8004 ? `${passports[0].erc8004.agent_id}@${passports[0].erc8004.agent_registry}` : "NONE")}</dd></div>
                  <div><dt>Agent</dt><dd>
                    <input
                      value={passportAgent}
                      disabled={passportBusy}
                      onChange={(event) => setPassportAgent(event.target.value)}
                    />
                  </dd></div>
                </dl>
                <div className="ops-evidence-actions">
                  <button
                    type="button"
                    disabled={passportBusy || !meta?.identity?.ready}
                    onClick={() => {
                      setPassportBusy(true);
                      void issuePassport({
                        agent_id: passportAgent.trim() || "desk-agent",
                        mandate: meta?.mandate?.template,
                        did: agentDid.trim() || undefined,
                        erc8004: erc8004Ref.trim() || undefined,
                      })
                        .then((row) => {
                          setPassportToken(row.token);
                          setPassports((current) => [row.passport, ...current.filter((item) => item.id !== row.passport.id)]);
                        })
                        .finally(() => setPassportBusy(false));
                    }}
                  >
                    ISSUE
                  </button>
                  {passports[0] && passports[0].status === "active" ? (
                    <button
                      type="button"
                      disabled={passportBusy || !meta?.mandate}
                      onClick={() => {
                        const id = passports[0]?.id;
                        if (!id) return;
                        setPassportBusy(true);
                        void bindPassport(id, meta?.mandate?.template)
                          .then((row) => {
                            setPassportToken(row.token);
                            setPassports((current) =>
                              current.map((item) => (item.id === row.passport.id ? row.passport : item)),
                            );
                          })
                          .finally(() => setPassportBusy(false));
                      }}
                    >
                      BIND
                    </button>
                  ) : null}
                  {passports[0] && passports[0].status === "active" ? (
                    <button
                      type="button"
                      disabled={passportBusy}
                      onClick={() => {
                        const id = passports[0]?.id;
                        if (!id) return;
                        setPassportBusy(true);
                        void revokePassport(id)
                          .then((row) => {
                            setPassports((current) => current.map((item) => (item.id === row.id ? { ...item, ...row } : item)));
                            setPassportToken("");
                          })
                          .finally(() => setPassportBusy(false));
                      }}
                    >
                      REVOKE
                    </button>
                  ) : null}
                </div>
              </article>

              <article className="ops-infra-card ready">
                <div className="ops-infra-card-head">
                  <span>06 · AGENT DX</span>
                  <ProofBadge state="done" label="READY" />
                </div>
                <h2>Agent interface</h2>
                <strong>Point an agent at the docs</strong>
                <dl>
                  <div><dt>Docs</dt><dd><a href="/docs">/docs</a></dd></div>
                  <div><dt>OpenAPI</dt><dd><a href="/openapi.yaml">/openapi.yaml</a></dd></div>
                  <div><dt>MCP</dt><dd>{meta?.mcp_tools?.length ?? 8} tools</dd></div>
                  <div><dt>Card</dt><dd>/.well-known/agent-card.json</dd></div>
                  <div><dt>Deck</dt><dd><a href="/pitch.html">/pitch.html</a></dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${meta?.ats?.configured ? "ready" : "blocked"}`}>
                <div className="ops-infra-card-head">
                  <span>07 · TOKENIZATION</span>
                  <ProofBadge state={meta?.ats?.configured ? "done" : "blocked"} label={meta?.ats?.configured ? "READY" : "SETUP"} />
                </div>
                <h2>Hedera ATS</h2>
                <strong>SDK {meta?.ats?.sdk_version ?? "8.0.0"}</strong>
                <dl>
                  <div><dt>Factory</dt><dd>{shortHash(meta?.ats?.factory_address ?? undefined)}</dd></div>
                  <div><dt>Resolver</dt><dd>{shortHash(meta?.ats?.resolver_address ?? undefined)}</dd></div>
                  <div><dt>Intents</dt><dd>{atsIntents.length}</dd></div>
                  <div><dt>Workspace</dt><dd><a href="/assets">/assets</a></dd></div>
                </dl>
              </article>

              <article className={`ops-infra-card ${liquidation?.joined ? "ready" : liquidation?.configured ? "optional" : "blocked"}`}>
                <div className="ops-infra-card-head">
                  <span>08 · SEPOLIA DEFENSE</span>
                  <ProofBadge
                    state={liquidation?.joined ? "done" : liquidation?.configured ? "waiting" : "blocked"}
                    label={liquidation?.joined ? "JOINED" : liquidation?.configured ? "LIVE" : "SETUP"}
                  />
                </div>
                <h2>Liquidation challenge</h2>
                <strong>{liquidation?.scenario?.state?.toUpperCase() ?? "UNCONFIGURED"}</strong>
                <dl>
                  <div><dt>Open</dt><dd>{liquidation?.challenge_open ? "Yes" : "No"}</dd></div>
                  <div><dt>HF x100</dt><dd>{liquidation?.position?.live_health_factor_x100 ?? "—"}</dd></div>
                  <div><dt>Score</dt><dd>{liquidation?.loan_continuity_score_bps ?? "—"}</dd></div>
                  <div><dt>Contract</dt><dd>
                    <a href={`${liquidation?.contracts.explorer ?? "https://sepolia.etherscan.io"}/address/${liquidation?.contracts.challenge ?? "0x88574e7Cc0027afd04951daa09B64d4441931ba1"}`} target="_blank" rel="noreferrer">
                      ChallengeLending
                    </a>
                  </dd></div>
                </dl>
              </article>
            </div>

            <section className="ops-posture">
              <span>POSTURE</span>
              <div>
                <b>NON-CUSTODIAL</b>
                <b>TESTNET PAYEE</b>
                <b>OFAC NOT SCREENED</b>
                <b>POLICY VALUES NEVER RETURNED</b>
                <b>IDEMPOTENT SETTLEMENT</b>
              </div>
            </section>
          </div>
        ) : null}
      </main>

      <RunTheater
        open={theaterOpen}
        pending={pending}
        statusLabel={STATUS_COPY[status]}
        runtimeLabel={formatDuration(runtime)}
        trace={trace}
        receipt={receipt}
        decision={decision}
        verdict={verdict}
        approveLabel={status === "review" ? `APPROVE ${formatHbar(invoice?.amount ?? meta?.amount)}` : undefined}
        onClose={() => setTheaterOpen(false)}
        onApprove={status === "review" ? () => void approveDecision() : undefined}
        onExport={receipt ? () => downloadJson("hop-evidence.json", receipt) : undefined}
        onReceipt={decision ? () => downloadJson("hop-decision.json", decision) : undefined}
        onVerifyLink={
          receipt
            ? () => {
                const url = `${window.location.origin}/verify/${receipt.id}`;
                void navigator.clipboard.writeText(url).then(() => {
                  setVerifyCopied(true);
                  window.setTimeout(() => setVerifyCopied(false), 1500);
                });
                navigate(`/verify/${receipt.id}`);
              }
            : undefined
        }
      />

      {wallOpen ? (
        <div className="ops-modal" role="dialog" aria-modal="true" aria-label="ATS">
          <section>
            <div className="ops-panel-head">
              <span>ATS · TESTNET LIFECYCLE</span>
              <button type="button" onClick={() => setWallOpen(false)}>CLOSE</button>
            </div>
            <strong>NO INVESTMENT RIGHTS</strong>
            <dl className="ops-evidence-dl">
              {(atsIntents.filter((item) => item.evidence_id === (receipt?.id ?? selectedEvidence?.id)).slice(0, 3)).map((item) => (
                <div key={item.id}>
                  <dt>{item.action}</dt>
                  <dd>{item.status.toUpperCase()} · {item.asset_contract ?? "NO CONTRACT"}</dd>
                </div>
              ))}
              {!atsIntents.some((item) => item.evidence_id === (receipt?.id ?? selectedEvidence?.id)) ? (
                <div><dt>Lifecycle</dt><dd>NONE FOR THIS EVIDENCE</dd></div>
              ) : null}
            </dl>
            <a href="/assets">OPEN STUDIO</a>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
};

type SpeechRecognitionEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
