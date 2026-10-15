// In-memory LiftRepository with the same semantics as the Drizzle one. Used by the tests; handy for local
// experiments too.

import { incomingWins } from './lww.mjs';

/** @typedef {import('./sync.mjs').LiftRepository} LiftRepository */
/** @typedef {import('./sync.mjs').PulledRow} PulledRow */

/**
 * @returns {LiftRepository & { rows: Map<string, PulledRow & { updatedAt: Date, deletedAt: Date | null }>, appliedKeys: Set<string> }}
 */
export function createMemoryRepository() {
  /** @type {Map<string, PulledRow & { updatedAt: Date, deletedAt: Date | null }>} */
  const rows = new Map();
  /** @type {Set<string>} */
  const appliedKeys = new Set();
  let seq = 0;

  return {
    rows,
    appliedKeys,
    async applyChange(change) {
      if (appliedKeys.has(change.idempotencyKey)) return 'duplicate';
      appliedKeys.add(change.idempotencyKey);
      const key = `${change.entity}:${change.id}`;
      if (!incomingWins(rows.get(key), change)) return 'stale';
      seq += 1;
      rows.set(key, {
        seq,
        entity: change.entity,
        id: change.id,
        payload: change.payload,
        updatedAt: change.updatedAt,
        deletedAt: change.deletedAt,
      });
      return 'applied';
    },
    async listSince(afterSeq, limit) {
      return [...rows.values()]
        .filter((row) => row.seq > afterSeq)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit)
        .map(({ seq: s, entity, id, payload }) => ({ seq: s, entity, id, payload }));
    },
  };
}
