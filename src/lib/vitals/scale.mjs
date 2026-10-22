// @ts-check
// The bathroom scale bridge (devices/scale-bridge): it posts weight_kg with this source, so Coach can tell its
// weigh-ins from Garmin's and notice when the bridge goes quiet.

export const SCALE_SOURCE = 'Renpho Elis 1 (scale bridge)';

const DAY = 864e5;

/**
 * A warning when the scale bridge has sent weigh-ins before but none for a while. Nothing before its first
 * weigh-in. Info (Settings only) from 4 days, a banner from 10: a travel week is normal, a dead board is not.
 * @param {string | null} lastDay newest weigh-in day from the bridge (YYYY-MM-DD), or null
 * @param {string} today the local day (YYYY-MM-DD)
 * @returns {{ level: 'warn' | 'info', text: string } | null}
 */
export function scaleWarning(lastDay, today) {
  if (!lastDay) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / DAY);
  if (!(days >= 4)) return null;
  const text = `No weigh-in from the bathroom scale for ${days} days. If you have been home, check the bridge at http://scale-bridge.local/.`;
  return { level: days >= 10 ? 'warn' : 'info', text };
}
