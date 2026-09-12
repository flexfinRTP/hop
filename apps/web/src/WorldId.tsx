import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type RpContext } from "@worldcoin/idkit";
import { worldRpContext, worldVerify } from "./api";

export function WorldIdButton({
  appId,
  action,
  environment,
  onToken,
  ok,
}: {
  appId: string;
  action: string;
  environment: "staging" | "production";
  onToken: (token: string) => void;
  ok: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rp, setRp] = useState<RpContext | null>(null);
  const [err, setErr] = useState("");

  async function start() {
    setErr("");
    try {
      const ctx = await worldRpContext();
      setRp({
        rp_id: ctx.rp_id,
        nonce: ctx.nonce,
        created_at: ctx.created_at,
        expires_at: ctx.expires_at,
        signature: ctx.sig,
      } as RpContext);
      setOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "world_rp");
    }
  }

  return (
    <div className="world-id">
      <button type="button" onClick={() => void start()}>
        {ok ? "World ID ok" : "World ID"}
      </button>
      {err ? <p className="status">{err}</p> : null}
      {rp ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId as `app_${string}`}
          action={action}
          rp_context={rp}
          allow_legacy_proofs={true}
          environment={environment}
          preset={proofOfHuman()}
          handleVerify={async (result) => {
            const verified = await worldVerify(result);
            onToken(verified.token);
          }}
          onSuccess={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
