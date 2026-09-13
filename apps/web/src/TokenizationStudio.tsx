import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AssetIntent, AssetTerms } from "@hop/shared";
import { executeAtsLifecycle, type AtsRuntimeConfig } from "./ats";
import {
  createAssetIntent,
  getAssetIntents,
  getAtsConfig,
  getEvidenceList,
  submitAssetTransactions,
  type EvidencePack,
} from "./api";
import { navigate } from "./nav";
import { HopWordmark } from "./HopWordmark";

type FormState = {
  evidence_id: string;
  name: string;
  symbol: string;
  instrument_id: string;
  currency: string;
  decimals: string;
  max_supply: string;
  nominal_value: string;
  nominal_value_decimals: string;
  starting_date: string;
  maturity_date: string;
  coupon_rate_bps: string;
  recipient: string;
  issue_amount: string;
};

const EMPTY: FormState = {
  evidence_id: "",
  name: "",
  symbol: "",
  instrument_id: "",
  currency: "",
  decimals: "",
  max_supply: "",
  nominal_value: "",
  nominal_value_decimals: "",
  starting_date: "",
  maturity_date: "",
  coupon_rate_bps: "",
  recipient: "",
  issue_amount: "",
};

function terms(form: FormState): AssetTerms {
  return {
    name: form.name.trim(),
    symbol: form.symbol.trim().toUpperCase(),
    instrument_id: form.instrument_id.trim().toUpperCase(),
    currency: form.currency.trim().toUpperCase(),
    decimals: Number(form.decimals),
    max_supply: form.max_supply.trim(),
    nominal_value: form.nominal_value.trim(),
    nominal_value_decimals: Number(form.nominal_value_decimals),
    starting_date: new Date(form.starting_date).toISOString(),
    maturity_date: new Date(form.maturity_date).toISOString(),
    coupon_rate_bps: Number(form.coupon_rate_bps),
  };
}

function short(value: string | null | undefined, size = 20): string {
  if (!value) return "—";
  return value.length > size ? `${value.slice(0, size)}…` : value;
}

export function TokenizationStudio() {
  const [config, setConfig] = useState<AtsRuntimeConfig | null>(null);
  const [evidence, setEvidence] = useState<EvidencePack[]>([]);
  const [intents, setIntents] = useState<AssetIntent[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [intent, setIntent] = useState<AssetIntent | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [kyc, setKyc] = useState(false);
  const [vcBase64, setVcBase64] = useState("");
  const [phase, setPhase] = useState<
    "loading" | "ready" | "creating" | "wallet" | "verifying" | "verified" | "error"
  >("loading");
  const [error, setError] = useState("");

  const eligible = useMemo(
    () => evidence.filter((item) => item.status === "accept"),
    [evidence],
  );

  async function refresh() {
    setPhase("loading");
    try {
      const [nextConfig, nextEvidence, nextIntents] = await Promise.all([
        getAtsConfig(),
        getEvidenceList(100),
        getAssetIntents(100),
      ]);
      setConfig(nextConfig);
      setEvidence(nextEvidence);
      setIntents(nextIntents);
      setForm((current) => ({
        ...current,
        evidence_id: current.evidence_id || nextEvidence.find((item) => item.status === "accept")?.id || "",
      }));
      setPhase("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "load_failed");
      setPhase("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function change(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("testnet_ack_required");
      return;
    }
    setError("");
    setPhase("creating");
    try {
      const created = await createAssetIntent({
        evidence_id: form.evidence_id,
        action: "issue_and_lock",
        terms: terms(form),
        controllist: "allowlist",
        clearing: false,
        kyc,
      });
      setIntent(created);
      setIntents((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setPhase("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "intent_failed");
      setPhase("error");
    }
  }

  async function followOn(action: AssetIntent["action"]) {
    if (!config || !intent || intent.status !== "verified") return;
    setError("");
    setPhase("creating");
    try {
      const created = await createAssetIntent({
        evidence_id: intent.evidence_id,
        action,
        terms: intent.terms,
        controllist: intent.controls.controllist,
        clearing: intent.controls.clearing,
        kyc: intent.controls.kyc,
        parent_intent_id: intent.id,
      });
      setIntent(created);
      setPhase("wallet");
      const execution = await executeAtsLifecycle(config, created, {
        recipient: form.recipient.trim(),
      });
      setPhase("verifying");
      const verified = await submitAssetTransactions(created.id, {
        wallet_account: execution.walletAccount,
        asset_contract: execution.assetContract,
        transactions: execution.transactions.map(({ stage, transaction_id }) => ({
          stage,
          transaction_id,
        })),
      });
      setIntent(verified);
      setIntents((current) => [verified, ...current.filter((item) => item.id !== verified.id)]);
      setPhase("verified");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ats_follow_on_failed");
      setPhase("error");
    }
  }

  async function execute() {
    if (!config || !intent) return;
    setError("");
    setPhase("wallet");
    try {
      const execution = await executeAtsLifecycle(config, intent, {
        recipient: form.recipient.trim(),
        issueAmount: form.issue_amount.trim(),
        vcBase64,
      });
      setPhase("verifying");
      const verified = await submitAssetTransactions(intent.id, {
        wallet_account: execution.walletAccount,
        asset_contract: execution.assetContract,
        transactions: execution.transactions.map(({ stage, transaction_id }) => ({
          stage,
          transaction_id,
        })),
      });
      setIntent(verified);
      setIntents((current) => [verified, ...current.filter((item) => item.id !== verified.id)]);
      setPhase("verified");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ats_execution_failed");
      setPhase("error");
    }
  }

  return (
    <div className="asset-shell">
      <header className="asset-top">
        <button type="button" onClick={() => navigate("/app")} className="asset-brand">
          <HopWordmark tone="cream" />
          <span>ATS</span>
        </button>
        <div className="asset-runtime">
          <span className={config?.configured ? "ok" : "bad"}>
            {config?.configured ? "CONFIGURED" : "UNCONFIGURED"}
          </span>
          <span>HEDERA TESTNET</span>
          <span>SDK {config?.sdk_version ?? "—"}</span>
        </div>
        <button type="button" onClick={() => void refresh()} className="asset-button secondary">
          REFRESH
        </button>
      </header>

      <main className="asset-main">
        <section className="asset-head">
          <div>
            <span>ASSET TOKENIZATION STUDIO</span>
            <h1>Private credit bond</h1>
          </div>
          <dl>
            <div><dt>Factory</dt><dd>{short(config?.factory_address)}</dd></div>
            <div><dt>Resolver</dt><dd>{short(config?.resolver_address)}</dd></div>
            <div><dt>Custody</dt><dd>BROWSER WALLET</dd></div>
          </dl>
        </section>

        <div className="asset-grid">
          <form className="asset-panel asset-form" onSubmit={create}>
            <div className="asset-panel-title">
              <span>01</span>
              <strong>INTENT</strong>
              <b>{phase.toUpperCase()}</b>
            </div>

            <label className="wide">
              <span>HOP EVIDENCE</span>
              <select
                required
                value={form.evidence_id}
                onChange={(event) => change("evidence_id", event.target.value)}
              >
                <option value="">SELECT</option>
                {eligible.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.status.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>NAME</span>
              <input required maxLength={80} value={form.name} onChange={(event) => change("name", event.target.value)} />
            </label>
            <label>
              <span>SYMBOL</span>
              <input required pattern="[A-Za-z0-9]{1,12}" value={form.symbol} onChange={(event) => change("symbol", event.target.value)} />
            </label>
            <label>
              <span>INSTRUMENT ID / 12</span>
              <input required minLength={12} maxLength={12} pattern="[A-Za-z0-9]{12}" value={form.instrument_id} onChange={(event) => change("instrument_id", event.target.value)} />
            </label>
            <label>
              <span>CURRENCY</span>
              <input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => change("currency", event.target.value)} />
            </label>
            <label>
              <span>DECIMALS</span>
              <input required type="number" min="0" max="18" value={form.decimals} onChange={(event) => change("decimals", event.target.value)} />
            </label>
            <label>
              <span>MAX SUPPLY / BASE UNITS</span>
              <input required inputMode="numeric" pattern="[0-9]+" value={form.max_supply} onChange={(event) => change("max_supply", event.target.value)} />
            </label>
            <label>
              <span>NOMINAL VALUE</span>
              <input required inputMode="numeric" pattern="[0-9]+" value={form.nominal_value} onChange={(event) => change("nominal_value", event.target.value)} />
            </label>
            <label>
              <span>NOMINAL DECIMALS</span>
              <input required type="number" min="0" max="18" value={form.nominal_value_decimals} onChange={(event) => change("nominal_value_decimals", event.target.value)} />
            </label>
            <label>
              <span>START</span>
              <input required type="datetime-local" value={form.starting_date} onChange={(event) => change("starting_date", event.target.value)} />
            </label>
            <label>
              <span>MATURITY</span>
              <input required type="datetime-local" value={form.maturity_date} onChange={(event) => change("maturity_date", event.target.value)} />
            </label>
            <label>
              <span>COUPON / BPS</span>
              <input required type="number" min="0" max="10000" step="100" value={form.coupon_rate_bps} onChange={(event) => change("coupon_rate_bps", event.target.value)} />
            </label>
            <label>
              <span>ISSUE / BASE UNITS</span>
              <input required inputMode="numeric" pattern="[0-9]+" value={form.issue_amount} onChange={(event) => change("issue_amount", event.target.value)} />
            </label>
            <label className="wide">
              <span>LOCK RECIPIENT</span>
              <input required pattern="(0\.0\.[0-9]+|0x[a-fA-F0-9]{40})" value={form.recipient} onChange={(event) => change("recipient", event.target.value)} />
            </label>

            <label className="asset-check wide">
              <input type="checkbox" checked={kyc} onChange={(event) => setKyc(event.target.checked)} />
              <span>INTERNAL KYC</span>
            </label>
            {kyc ? (
              <label className="wide">
                <span>KYC VC / BASE64</span>
                <textarea required={kyc} value={vcBase64} onChange={(event) => setVcBase64(event.target.value)} />
              </label>
            ) : null}
            <label className="asset-check wide">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>TESTNET / NO INVESTMENT RIGHTS</span>
            </label>

            <div className="asset-actions wide">
              <button className="asset-button" type="submit" disabled={!config?.configured || phase === "creating" || phase === "wallet" || phase === "verifying"}>
                CREATE INTENT
              </button>
              <button className="asset-button dark" type="button" disabled={!intent || !accepted || phase === "wallet" || phase === "verifying"} onClick={() => void execute()}>
                CONNECT + EXECUTE
              </button>
            </div>
            {error ? <output className="asset-error wide">{error}</output> : null}
          </form>

          <section className="asset-panel asset-lifecycle">
            <div className="asset-panel-title">
              <span>02</span>
              <strong>LIFECYCLE</strong>
              <b>{intent?.status.toUpperCase() ?? "WAITING"}</b>
            </div>
            {["factory", "roles", "compliance", "kyc", "issue", "lifecycle", "coupon", "redeem", "pause", "unpause"].map((stage, index) => {
              const rows = intent?.transactions.filter((transaction) => transaction.stage === stage) ?? [];
              return (
                <div className="asset-stage" key={stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{stage.toUpperCase()}</strong>
                  <b>{rows.length ? (rows.every((row) => row.verified) ? "VERIFIED" : "FAILED") : "PENDING"}</b>
                  {rows.map((row) => (
                    <a
                      key={row.transaction_id}
                      href={`${config?.explorer_url ?? "https://hashscan.io/testnet"}/transaction/${encodeURIComponent(row.transaction_id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(row.transaction_id, 28)}
                    </a>
                  ))}
                </div>
              );
            })}
            <dl className="asset-proof">
              <div><dt>Intent</dt><dd>{short(intent?.id, 30)}</dd></div>
              <div><dt>Asset</dt><dd>{short(intent?.asset_contract, 30)}</dd></div>
              <div><dt>HCS</dt><dd>{intent?.hcs_topic && intent.hcs_seq ? `${intent.hcs_topic} / ${intent.hcs_seq}` : "—"}</dd></div>
              <div><dt>Control list</dt><dd>{intent?.controls.controllist.toUpperCase() ?? "ALLOWLIST"}</dd></div>
              <div><dt>Internal KYC</dt><dd>{intent?.controls.kyc ? "ON" : "OFF"}</dd></div>
              <div><dt>Clearing</dt><dd>{intent?.controls.clearing ? "ON" : "OFF"}</dd></div>
            </dl>
            {intent?.status === "verified" ? (
              <div className="asset-actions wide">
                <button className="asset-button secondary" type="button" onClick={() => void followOn("coupon")}>COUPON</button>
                <button className="asset-button secondary" type="button" onClick={() => void followOn("pause")}>PAUSE</button>
                <button className="asset-button secondary" type="button" onClick={() => void followOn("unpause")}>UNPAUSE</button>
                <button className="asset-button secondary" type="button" onClick={() => void followOn("redeem")}>REDEEM</button>
              </div>
            ) : null}
          </section>
        </div>

        <section className="asset-panel asset-history">
          <div className="asset-panel-title">
            <span>03</span>
            <strong>INTENTS</strong>
            <b>{intents.length}</b>
          </div>
          <div className="asset-table">
            <div className="head"><span>ID</span><span>EVIDENCE</span><span>ASSET</span><span>STATUS</span></div>
            {intents.map((item) => (
              <button key={item.id} type="button" onClick={() => setIntent(item)}>
                <span>{short(item.id, 18)}</span>
                <span>{short(item.evidence_id, 18)}</span>
                <span>{short(item.asset_contract, 18)}</span>
                <b>{item.status.toUpperCase()}</b>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
