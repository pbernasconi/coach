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

/**
 * The scan date of a BodySpec PDF report from its text: the last date on the line under the "Measured Date" header
 * (the line also carries the birth date), as YYYY-MM-DD, or null.
 * @param {string} text
 * @returns {string | null}
 */
export function measuredDate(text) {
  const m = /Measured Date[^\n]*\n([^\n]*)/.exec(text);
  const dates = m ? [...m[1].matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)] : [];
  const last = dates.at(-1);
  if (!last) return null;
  const [, mo, d, y] = last;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

/**
 * Picks the scan image among a report page's images: the whole-body image is tall and narrow (about 1 : 2.9).
 * @template {{ width: number, height: number }} T
 * @param {T[]} images
 * @returns {T | null}
 */
export function pickScanImage(images) {
  return images.filter((i) => i.width >= 80 && i.height / i.width > 2.2 && i.height / i.width < 4).sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}
