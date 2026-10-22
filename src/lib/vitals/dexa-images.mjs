// @ts-check
/** BodySpec scan images: the four views it shows for each scan, and reading the view from a file name. */

/** The scan image views BodySpec shows, in its order. */
export const IMAGE_VIEWS = /** @type {const} */ (['composite', 'fat', 'lean', 'bone']);
/** @typedef {typeof IMAGE_VIEWS[number]} ImageView */
export const IMAGE_VIEW_LABELS = /** @type {Record<ImageView, string>} */ ({ composite: 'Composite', fat: 'Fat', lean: 'Lean', bone: 'Bone' });

/**
 * The view of a scan image from its file name ("…-fat-tissue.png", "Bone.png", "composite.jpg"), or null.
 * @param {string} name
 * @returns {ImageView | null}
 */
export function viewForName(name) {
  const n = name.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  if (/compos/.test(n)) return 'composite';
  if (/(^|[^a-z])fat([^a-z]|$)/.test(n)) return 'fat';
  if (/(^|[^a-z])lean([^a-z]|$)/.test(n)) return 'lean';
  if (/(^|[^a-z])(bone|bmd|skeleton)([^a-z]|$)/.test(n)) return 'bone';
  return null;
}

/** @param {unknown} v @returns {v is ImageView} */
export function isImageView(v) {
  return typeof v === 'string' && /** @type {readonly string[]} */ (IMAGE_VIEWS).includes(v);
}
