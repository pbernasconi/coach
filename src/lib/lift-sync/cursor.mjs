// Pull cursors. The cursor is opaque to the client; on the server it is the decimal `seq` of the last change
// returned (lift/SYNC.md shows "1287"). No cursor means "from the beginning".

/**
 * @param {number} seq
 * @returns {string}
 */
export function encodeCursor(seq) {
  if (!Number.isSafeInteger(seq) || seq < 0) throw new RangeError(`invalid seq ${seq}`);
  return String(seq);
}

/**
 * @param {string | null | undefined} cursor
 * @returns {number | null} the seq to read after, 0 for a full pull, or null when the cursor is invalid
 */
export function decodeCursor(cursor) {
  if (cursor === null || cursor === undefined || cursor === '') return 0;
  if (!/^\d{1,15}$/.test(cursor)) return null;
  return Number(cursor);
}
