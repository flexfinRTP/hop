import type { Pool, PoolClient } from "pg";

export type DurableClaimState =
  | "claimed"
  | "verified"
  | "settling"
  | "settled"
  | "fulfilled"
  | "failed";

export type DurableClaim = {
  idempotencyKey: string;
  bodyHash: string;
  paymentHash: string;
  state: DurableClaimState;
  settlementRef?: string;
  evidenceId?: string;
};

export type DurableClaimResult =
  | { status: "disabled" }
  | { status: "acquired"; claim: DurableClaim }
  | { status: "existing"; claim: DurableClaim; evidence?: unknown }
  | { status: "conflict" }
  | { status: "payment_replay" }
  | { status: "in_flight"; claim: DurableClaim };

let pool: Pool | null = null;

function claimFromRow(row: Record<string, unknown>): DurableClaim {
  return {
    idempotencyKey: String(row.idempotency_key),
    bodyHash: String(row.body_hash),
    paymentHash: String(row.payment_hash),
    state: String(row.state) as DurableClaimState,
    settlementRef: row.settlement_ref ? String(row.settlement_ref) : undefined,
    evidenceId: row.evidence_id ? String(row.evidence_id) : undefined,
  };
}

async function migrate(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hop_evidence (
      id uuid PRIMARY KEY,
      idempotency_key text UNIQUE,
      body_hash text,
      payment_hash text UNIQUE,
      payload jsonb NOT NULL,
      stored_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS hop_evidence_stored_at_idx
      ON hop_evidence (stored_at DESC);

    CREATE TABLE IF NOT EXISTS hop_request_claims (
      idempotency_key text PRIMARY KEY,
      body_hash text NOT NULL,
      payment_hash text NOT NULL UNIQUE,
      request_payload jsonb NOT NULL,
      state text NOT NULL CHECK (
        state IN ('claimed', 'verified', 'settling', 'settled', 'fulfilled', 'failed')
      ),
      payer text,
      settlement_ref text,
      evidence_id uuid REFERENCES hop_evidence(id),
      error_code text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS hop_request_claims_state_idx
      ON hop_request_claims (state, updated_at);

    CREATE TABLE IF NOT EXISTS hop_mandate_ledger (
      reservation_id uuid PRIMARY KEY,
      mandate_id text NOT NULL,
      amount_tinybars bigint NOT NULL CHECK (amount_tinybars >= 0),
      reserved_at timestamptz NOT NULL DEFAULT now(),
      released_at timestamptz
    );

    CREATE INDEX IF NOT EXISTS hop_mandate_ledger_active_idx
      ON hop_mandate_ledger (mandate_id, reserved_at)
      WHERE released_at IS NULL;

    CREATE TABLE IF NOT EXISTS hop_hcs_outbox (
      evidence_id uuid PRIMARY KEY REFERENCES hop_evidence(id),
      payload jsonb NOT NULL,
      state text NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'processing', 'submitted', 'failed')),
      attempts integer NOT NULL DEFAULT 0,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hop_asset_intents (
      id uuid PRIMARY KEY,
      evidence_id uuid NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS hop_asset_intents_evidence_idx
      ON hop_asset_intents (evidence_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS hop_passports (
      id uuid PRIMARY KEY,
      agent_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('active', 'revoked')),
      payload jsonb NOT NULL,
      issued_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS hop_passports_agent_idx
      ON hop_passports (agent_id, status, issued_at DESC);
  `);
}

export async function initDatabase(
  databaseUrl: string,
  options?: { ssl?: boolean },
): Promise<boolean> {
  if (!databaseUrl.trim()) return false;
  const { Pool } = await import("pg");
  pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.HOP_DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: options?.ssl ? { rejectUnauthorized: true } : undefined,
  });
  const client = await pool.connect();
  try {
    await migrate(client);
  } finally {
    client.release();
  }
  return true;
}

export function databaseReady(): boolean {
  return pool !== null;
}

export async function loadDurableEvidence(ttlMs: number): Promise<unknown[]> {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT payload
       FROM hop_evidence
      WHERE stored_at >= now() - ($1::bigint * interval '1 millisecond')
      ORDER BY stored_at ASC`,
    [ttlMs],
  );
  return result.rows.map((row) => row.payload);
}

export async function persistDurableEvidence(row: {
  id: string;
  idempotencyKey?: string;
  bodyHash?: string;
  paymentHash?: string;
  payload: unknown;
  storedAt: number;
}): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO hop_evidence
       (id, idempotency_key, body_hash, payment_hash, payload, stored_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       stored_at = EXCLUDED.stored_at`,
    [
      row.id,
      row.idempotencyKey ?? null,
      row.bodyHash ?? null,
      row.paymentHash ?? null,
      JSON.stringify(row.payload),
      row.storedAt,
    ],
  );
}

export async function claimDurableRequest(input: {
  idempotencyKey: string;
  bodyHash: string;
  paymentHash: string;
  requestPayload: unknown;
}): Promise<DurableClaimResult> {
  if (!pool) return { status: "disabled" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO hop_request_claims
         (idempotency_key, body_hash, payment_hash, request_payload, state)
       VALUES ($1, $2, $3, $4::jsonb, 'claimed')
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        input.idempotencyKey,
        input.bodyHash,
        input.paymentHash,
        JSON.stringify(input.requestPayload),
      ],
    );
    if (inserted.rowCount === 1) {
      await client.query("COMMIT");
      return { status: "acquired", claim: claimFromRow(inserted.rows[0]) };
    }

    const byIdempotency = await client.query(
      `SELECT c.*, e.payload AS evidence
         FROM hop_request_claims c
         LEFT JOIN hop_evidence e ON e.id = c.evidence_id
        WHERE c.idempotency_key = $1
        FOR UPDATE OF c`,
      [input.idempotencyKey],
    );
    if (byIdempotency.rowCount === 1) {
      const row = byIdempotency.rows[0] as Record<string, unknown>;
      const claim = claimFromRow(row);
      await client.query("COMMIT");
      if (claim.bodyHash !== input.bodyHash) return { status: "conflict" };
      if (claim.paymentHash !== input.paymentHash) return { status: "payment_replay" };
      if (claim.state === "fulfilled") {
        return { status: "existing", claim, evidence: row.evidence };
      }
      return { status: "in_flight", claim };
    }

    const byPayment = await client.query(
      `SELECT idempotency_key
         FROM hop_request_claims
        WHERE payment_hash = $1`,
      [input.paymentHash],
    );
    await client.query("COMMIT");
    return byPayment.rowCount
      ? { status: "payment_replay" }
      : { status: "in_flight", claim: {
          idempotencyKey: input.idempotencyKey,
          bodyHash: input.bodyHash,
          paymentHash: input.paymentHash,
          state: "claimed",
        } };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateDurableClaim(
  idempotencyKey: string,
  state: DurableClaimState,
  values?: {
    payer?: string;
    settlementRef?: string;
    evidenceId?: string;
    errorCode?: string;
  },
): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE hop_request_claims
        SET state = $2,
            payer = COALESCE($3, payer),
            settlement_ref = COALESCE($4, settlement_ref),
            evidence_id = COALESCE($5::uuid, evidence_id),
            error_code = $6,
            updated_at = now()
      WHERE idempotency_key = $1`,
    [
      idempotencyKey,
      state,
      values?.payer ?? null,
      values?.settlementRef ?? null,
      values?.evidenceId ?? null,
      values?.errorCode ?? null,
    ],
  );
}

export async function releaseDurableClaim(idempotencyKey: string): Promise<void> {
  if (!pool) return;
  await pool.query(
    `DELETE FROM hop_request_claims
      WHERE idempotency_key = $1
        AND state IN ('claimed', 'verified')`,
    [idempotencyKey],
  );
}

export async function enqueueHcsEvidence(evidenceId: string, payload: unknown): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO hop_hcs_outbox (evidence_id, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (evidence_id) DO NOTHING`,
    [evidenceId, JSON.stringify(payload)],
  );
}

export async function takeHcsOutbox(
  limit = 10,
): Promise<{ evidenceId: string; payload: Record<string, unknown> }[]> {
  if (!pool) return [];
  const result = await pool.query(
    `WITH picked AS (
       SELECT evidence_id
         FROM hop_hcs_outbox
        WHERE state IN ('pending', 'failed')
          AND attempts < 8
        ORDER BY updated_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
     )
     UPDATE hop_hcs_outbox o
        SET state = 'processing',
            attempts = attempts + 1,
            updated_at = now()
       FROM picked
      WHERE o.evidence_id = picked.evidence_id
     RETURNING o.evidence_id, o.payload`,
    [Math.max(1, Math.min(limit, 50))],
  );
  return result.rows.map((row) => ({
    evidenceId: String(row.evidence_id),
    payload: row.payload as Record<string, unknown>,
  }));
}

export async function completeHcsOutbox(
  evidenceId: string,
  success: boolean,
  error?: string,
): Promise<void> {
  if (!pool) return;
  await pool.query(
    `UPDATE hop_hcs_outbox
        SET state = $2,
            last_error = $3,
            updated_at = now()
      WHERE evidence_id = $1`,
    [evidenceId, success ? "submitted" : "failed", error?.slice(0, 500) ?? null],
  );
}

export async function persistAssetIntent(row: {
  id: string;
  evidenceId: string;
  payload: unknown;
  updatedAt: string;
}): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO hop_asset_intents (id, evidence_id, payload, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::timestamptz)
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       updated_at = EXCLUDED.updated_at`,
    [row.id, row.evidenceId, JSON.stringify(row.payload), row.updatedAt],
  );
}

export async function loadAssetIntents(): Promise<unknown[]> {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT payload
       FROM hop_asset_intents
      ORDER BY updated_at ASC`,
  );
  return result.rows.map((row) => row.payload);
}

export async function persistPassport(row: {
  id: string;
  agentId: string;
  status: string;
  payload: unknown;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}): Promise<void> {
  if (!pool) return;
  await pool.query(
    `INSERT INTO hop_passports
       (id, agent_id, status, payload, issued_at, expires_at, revoked_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz, $7::timestamptz, now())
     ON CONFLICT (id) DO UPDATE SET
       agent_id = EXCLUDED.agent_id,
       status = EXCLUDED.status,
       payload = EXCLUDED.payload,
       expires_at = EXCLUDED.expires_at,
       revoked_at = EXCLUDED.revoked_at,
       updated_at = now()`,
    [
      row.id,
      row.agentId,
      row.status,
      JSON.stringify(row.payload),
      row.issuedAt,
      row.expiresAt,
      row.revokedAt ?? null,
    ],
  );
}

export async function loadPassports(): Promise<unknown[]> {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT payload FROM hop_passports ORDER BY issued_at ASC`,
  );
  return result.rows.map((row) => row.payload);
}

export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = null;
  await current?.end();
}
