import { useEffect, useState } from "react";
import { getVerify, type VerifyPack } from "./api";
import { HopWordmark } from "./HopWordmark";
import { navigate } from "./nav";

function pathId(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "verify" ? (parts[1] ?? "") : "";
}

function hashscanTx(ref: string): string {
  const match = ref.match(/^(.+)@(\d+)\.(\d+)$/);
  const id = match ? `${match[1]}-${match[2]}-${match[3]}` : ref.replace("@", "-");
  return `https://hashscan.io/testnet/transaction/${id}`;
}

export function VerifyPage() {
  const [id, setId] = useState(pathId);
  const [pack, setPack] = useState<VerifyPack | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onPop = () => setId(pathId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!id) {
      setError("missing_id");
      setPack(null);
      return;
    }
    let cancelled = false;
    setError("");
    setPack(null);
    void getVerify(id)
      .then((row) => {
        if (!cancelled) setPack(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "verify_failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const receipt = pack?.receipt;
  const tiers = pack?.tiers;

  async function copyLink() {
    const url = `${window.location.origin}/verify/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="verify-page">
      <header className="verify-head">
        <button type="button" className="verify-brand" onClick={() => navigate("/")}>
          <HopWordmark />
        </button>
        <strong>VERIFY</strong>
        <button type="button" onClick={() => navigate("/app")}>
          DECISION ROOM
        </button>
      </header>
      <main className="verify-main">
        <p className="verify-id">{id || "—"}</p>
        {error ? <p className="verify-error">{error}</p> : null}
        {!error && !pack ? <p className="verify-wait">CHECKING</p> : null}
        {pack ? (
          <div className="verify-sheet">
            <div className={`verify-ok ${pack.ok ? "ok" : "bad"}`}>
              {pack.ok ? "OK" : "FAIL"}
            </div>
            <dl className="verify-dl">
              <div>
                <dt>VERDICT</dt>
                <dd>{receipt?.decision.verdict ?? "—"}</dd>
              </div>
              <div>
                <dt>REASON</dt>
                <dd>{receipt?.decision.reason_code ?? "—"}</dd>
              </div>
              <div>
                <dt>SCREENING</dt>
                <dd>
                  OFAC {receipt?.screening?.ofac ?? "not_screened"} · KYC{" "}
                  {receipt?.screening?.kyc ?? "not_performed"}
                </dd>
              </div>
              <div>
                <dt>HASHES</dt>
                <dd>{tiers?.recomputed ? "OK" : "FAIL"}</dd>
              </div>
              <div>
                <dt>SETTLEMENT</dt>
                <dd>{tiers?.settlement_confirmed ? "OK" : "FAIL"}</dd>
              </div>
              <div>
                <dt>HCS</dt>
                <dd>
                  {pack.hcs_present === false ? "SKIP" : tiers?.hcs_confirmed ? "OK" : "FAIL"}
                </dd>
              </div>
              <div>
                <dt>CRE SIM</dt>
                <dd>{tiers?.cre_simulation ? "OK" : "FAIL"}</dd>
              </div>
              <div>
                <dt>DON</dt>
                <dd>{tiers?.cre_don_verified ? "OK" : "—"}</dd>
              </div>
              <div>
                <dt>PASSPORT</dt>
                <dd>{receipt?.identity?.passport_id ?? "NONE"}</dd>
              </div>
              <div>
                <dt>DID</dt>
                <dd>{receipt?.identity?.did ?? "NONE"}</dd>
              </div>
              <div>
                <dt>ERC-8004</dt>
                <dd>
                  {receipt?.identity?.erc8004
                    ? `${receipt.identity.erc8004.agent_id}@${receipt.identity.erc8004.agent_registry}`
                    : "NONE"}
                </dd>
              </div>
              <div>
                <dt>PAY RAIL</dt>
                <dd>{receipt?.payment.rail ?? "hedera_x402_exact"}</dd>
              </div>
            </dl>
            <div className="verify-actions">
              <button type="button" onClick={() => void copyLink()}>
                {copied ? "COPIED" : "COPY LINK"}
              </button>
              {receipt?.payment.ref ? (
                <a href={hashscanTx(receipt.payment.ref)} target="_blank" rel="noreferrer">
                  HASHSCAN
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
