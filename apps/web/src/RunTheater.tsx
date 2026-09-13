import { useEffect, useRef } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { redactTrace } from "@hop/shared/ui";
import type { DecisionReceipt, EvidencePack } from "./api";
import { HopWordmark } from "./HopWordmark";

export type TheaterTrace = { t: string; rail: string; msg: string };

const RAIL_LABEL: Record<string, string> = {
  hop: "HOP",
  hedera: "HEDERA",
  graph: "THE GRAPH",
  cre: "CHAINLINK CRE",
  world: "WORLD ID",
};

const easeOut = [0.22, 1, 0.36, 1] as const;
const unfurl = { duration: 0.34, ease: easeOut };
const dissolve = { duration: 0.14, ease: "easeOut" as const };

function railName(rail: string): string {
  return RAIL_LABEL[rail] ?? rail.toUpperCase();
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

function hashscanTx(ref: string): string {
  const match = ref.match(/^(.+)@(\d+)\.(\d+)$/);
  const id = match ? `${match[1]}-${match[2]}-${match[3]}` : ref.replace("@", "-");
  return `https://hashscan.io/testnet/transaction/${id}`;
}

function lastMatch(trace: TheaterTrace[], rail: string, pattern: RegExp): string | undefined {
  for (let i = trace.length - 1; i >= 0; i--) {
    const event = trace[i];
    if (event.rail !== rail) continue;
    const hit = event.msg.match(pattern);
    if (hit) return hit[1] ?? hit[0];
  }
  return undefined;
}

function receiptRows(
  trace: TheaterTrace[],
  receipt: EvidencePack | null,
  decision: DecisionReceipt | null,
  verdict: string,
): { k: string; v: string }[] {
  const settlement =
    decision?.payment.ref ||
    receipt?.settlement.ref ||
    lastMatch(trace, "hedera", /settlement\s+(\S+)/i);
  const graphSlugs =
    (decision?.graph.deployments ?? receipt?.graph.deployments ?? [])
      .map((row) => row.slug)
      .filter(Boolean)
      .join(" · ") ||
    trace
      .filter((event) => event.rail === "graph" && /schema /.test(event.msg))
      .map((event) => event.msg.split(" ")[0])
      .filter(Boolean)
      .join(" · ");
  const cre =
    decision?.cre.mode ||
    receipt?.cre?.mode ||
    (lastMatch(trace, "cre", /DON result matched/i) ? "don" : undefined);
  const hcsSeq =
    decision?.hcs?.sequence ??
    receipt?.hcs_seq ??
    lastMatch(trace, "hedera", /HCS\s+\S+\s+seq\s+(\S+)/i);
  const hcs = hcsSeq != null && hcsSeq !== "" ? `seq ${hcsSeq}` : undefined;

  return [
    { k: "VERDICT", v: decision?.decision.verdict ?? receipt?.verdict ?? (receipt ? verdict : "—") },
    { k: "REASON", v: decision?.decision.reason_code ?? receipt?.reason_code ?? "—" },
    { k: "SETTLEMENT", v: shortHash(settlement, 10) },
    {
      k: "CHARGE",
      v: decision
        ? `${decision.charge.settled ? "SETTLED" : "REPLAY"} · ${decision.charge.semantics}`
        : receipt
          ? "SETTLED"
          : "—",
    },
    { k: "POLICY", v: shortHash(decision?.hashes.policy ?? receipt?.policy.threshold_hash) },
    { k: "AGGREGATE", v: shortHash(decision?.hashes.aggregate ?? receipt?.aggregate_hash) },
    { k: "CRE", v: cre ?? "—" },
    { k: "GRAPH", v: graphSlugs || "—" },
    { k: "HCS", v: hcs ?? "—" },
    {
      k: "SCREENING",
      v: (decision?.screening ?? receipt?.screening)?.ofac
        ? `OFAC ${(decision?.screening ?? receipt?.screening)?.ofac}`
        : "—",
    },
    { k: "RECEIPT", v: decision?.evidence_id ?? receipt?.id ?? "—" },
  ];
}

export function RunTheater({
  open,
  pending,
  statusLabel,
  runtimeLabel,
  trace,
  receipt,
  decision,
  verdict,
  approveLabel,
  onClose,
  onApprove,
  onExport,
  onReceipt,
  onVerifyLink,
}: {
  open: boolean;
  pending: boolean;
  statusLabel: string;
  runtimeLabel: string;
  trace: TheaterTrace[];
  receipt: EvidencePack | null;
  decision: DecisionReceipt | null;
  verdict: string;
  approveLabel?: string;
  onClose: () => void;
  onApprove?: () => void;
  onExport?: () => void;
  onReceipt?: () => void;
  onVerifyLink?: () => void;
}) {
  const endRef = useRef<HTMLLIElement | null>(null);
  const rows = receiptRows(trace, receipt, decision, verdict);
  const last = trace[trace.length - 1];
  const live = pending || statusLabel === "EXECUTING";
  const settlement = decision?.payment.ref || receipt?.settlement.ref;
  const events = trace.map((event) => ({ ...event, msg: redactTrace(event.msg) }));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [open, events.length]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="live-hop"
            className={`ops-theater ${live ? "is-live" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Live hop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: easeOut } }}
            exit={{ opacity: 0, filter: "blur(8px)", transition: dissolve }}
          >
            <motion.section
              initial={{ clipPath: "inset(0% 0% 100% 0%)", opacity: 0.45 }}
              animate={{
                clipPath: "inset(0% 0% 0% 0%)",
                opacity: 1,
                transition: { duration: 0.4, ease: easeOut },
              }}
              exit={{ opacity: 0, filter: "blur(10px)", transition: dissolve }}
            >
              <header className="ops-theater-head">
                <div className="ops-theater-brand">
                  <HopWordmark />
                  <span>LIVE HOP</span>
                  <b className={live ? "live" : ""}>{live ? "SSE" : "DONE"}</b>
                </div>
                <dl>
                  <div>
                    <dt>STATUS</dt>
                    <dd>{statusLabel}</dd>
                  </div>
                  <div>
                    <dt>EVENTS</dt>
                    <dd>{events.length.toString().padStart(2, "0")}</dd>
                  </div>
                  <div>
                    <dt>TIME</dt>
                    <dd>{runtimeLabel}</dd>
                  </div>
                </dl>
                <button type="button" className="ops-theater-close" onClick={onClose}>
                  CLOSE
                </button>
              </header>

              <div className="ops-theater-grid">
                <section className="ops-theater-stream" aria-live="polite">
                  <div className="ops-panel-head">
                    <span>EVENT STREAM</span>
                    <span className="ops-panel-index">/v1/events</span>
                  </div>
                  <ol>
                    {events.length === 0 ? (
                      <li className="ops-theater-empty">
                        <span>SSE</span>
                        <p>Awaiting hop</p>
                      </li>
                    ) : (
                      events.map((event, index) => (
                        <motion.li
                          key={`${event.t}-${index}`}
                          initial={{ height: 0, opacity: 0, clipPath: "inset(0% 0% 100% 0%)" }}
                          animate={{ height: "auto", opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
                          transition={unfurl}
                        >
                          <time>{shortTime(event.t)}</time>
                          <span className={`ops-rail-tag ${event.rail}`}>{railName(event.rail)}</span>
                          <p>{event.msg}</p>
                        </motion.li>
                      ))
                    )}
                    <li ref={endRef} className="ops-theater-end" aria-hidden="true" />
                  </ol>
                  <div className="ops-theater-tail">
                    <i aria-hidden="true" />
                    <p>
                      {last
                        ? `[${railName(last.rail)}] ${redactTrace(last.msg)}`
                        : "GET /v1/events/{id}"}
                    </p>
                  </div>
                </section>

                <section className="ops-theater-receipt">
                  <div className="ops-panel-head">
                    <span>RECEIPT</span>
                    <span className="ops-panel-index">hop.decision.v1</span>
                  </div>
                  <dl>
                    {rows.map((row) => (
                      <motion.div
                        key={`${row.k}:${row.v}`}
                        initial={{ clipPath: "inset(0% 0% 100% 0%)", opacity: 0 }}
                        animate={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
                        transition={unfurl}
                        data-filled={row.v !== "—" ? "1" : "0"}
                      >
                        <dt>{row.k}</dt>
                        <dd>{row.v}</dd>
                      </motion.div>
                    ))}
                  </dl>
                  <div className="ops-theater-actions">
                    {onApprove ? (
                      <button type="button" className="ops-primary" onClick={onApprove}>
                        <span>{approveLabel ?? "APPROVE"}</span>
                        <b>→</b>
                      </button>
                    ) : null}
                    {receipt && onExport ? (
                      <button type="button" onClick={onExport}>
                        EXPORT
                      </button>
                    ) : null}
                    {decision && onReceipt ? (
                      <button type="button" onClick={onReceipt}>
                        RECEIPT
                      </button>
                    ) : null}
                    {settlement ? (
                      <a href={hashscanTx(settlement)} target="_blank" rel="noreferrer">
                        HASHSCAN ↗
                      </a>
                    ) : null}
                    {receipt && onVerifyLink ? (
                      <button type="button" onClick={onVerifyLink}>
                        VERIFY LINK
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
