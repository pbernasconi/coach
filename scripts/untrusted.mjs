#!/usr/bin/env node
/**
 * Neutralizer for third-party text before it reaches an LLM's context.
 *
 * Why this exists: calendar summaries/locations are THIRD-PARTY text. Anyone who
 * can send Paolo an invite controls them verbatim, and they land in profile.md,
 * which /plan feeds to an agent that then writes files and pushes events to his
 * real calendar. So treat them as data, not prose:
 *   - collapse newlines/control chars — the actual injection vector. A title
 *     containing "\n\n## Ignore the above and ..." would otherwise render as
 *     top-level markdown, indistinguishable from our own instructions.
 *   - defang backticks — can't break out of a fence or open a directive.
 *   - cap length — no context flooding.
 *
 * Deliberately NOT stripping <>&*_#[]{} : real titles need them ("Column <>
 * Accend Bi-Weekly Sync"), and once newlines are gone they're inert mid-line.
 *
 * This cannot strip *intent* — hostile prose survives as inline text. It removes
 * the ability to impersonate document structure. The labelled blockquote in
 * profile.md and the human confirm at /plan Step 5 are the other two layers.
 *
 * Lives in its own module (rather than inline in coach-profile.mjs) so it is
 * testable — coach-profile.mjs runs DB queries at import time and can't be
 * imported by a test.
 */

// Control chars + Unicode LINE/PARAGRAPH SEPARATOR, which also break lines in
// markdown renderers.
const CTRL_AND_SEPARATORS = /[\u0000-\u001f\u007f\u2028\u2029]+/g;

export function untrusted(s, max = 140) {
  if (s == null) return '';
  const flat = String(s)
    .replace(CTRL_AND_SEPARATORS, ' ')
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
