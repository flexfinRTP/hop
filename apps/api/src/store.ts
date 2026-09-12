/** Evidence store. Same Idempotency-Key → same evidence id, no second settle. */
export type StoredEvidence = {
  id: string;
  idempotencyKey?: string;
  json: unknown;
};

const byId = new Map<string, StoredEvidence>();
const byIdempotency = new Map<string, string>();

export function getById(id: string): StoredEvidence | undefined {
  return byId.get(id);
}

export function getByIdempotency(key: string): StoredEvidence | undefined {
  const id = byIdempotency.get(key);
  return id ? byId.get(id) : undefined;
}

export function put(row: StoredEvidence): void {
  byId.set(row.id, row);
  if (row.idempotencyKey) byIdempotency.set(row.idempotencyKey, row.id);
}
