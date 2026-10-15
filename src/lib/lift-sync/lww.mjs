// Last writer wins, per row, by the row's `updatedAt` (lift/SYNC.md). A tie keeps the stored row, matching
// the SQL `WHERE excluded.updated_at > lift_rows.updated_at` in the Drizzle repository.

/**
 * @param {{ updatedAt: Date } | null | undefined} stored the row on the server, if any
 * @param {{ updatedAt: Date }} incoming
 * @returns {boolean} whether `incoming` replaces `stored`
 */
export function incomingWins(stored, incoming) {
  if (!stored) return true;
  return incoming.updatedAt.getTime() > stored.updatedAt.getTime();
}
