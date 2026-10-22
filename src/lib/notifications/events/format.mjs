// Plain text for notice bodies. Numbers and labels only: no generated commentary (lift/CLAUDE.md).

/** "52 min", "1:12 h". */
export function durationText(seconds) {
  const m = Math.round(Math.max(0, seconds) / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
}

/** "10.2 km", "850 m". */
export function distanceText(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Pace per km, "5:07 /km". */
export function paceText(seconds, meters) {
  const s = Math.round(seconds / (meters / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

/** "6,440 kg". */
export const volumeText = (v, unit) => `${Math.round(v).toLocaleString('en-US')} ${unit}`;

/** "1 set", "18 sets". */
export const countText = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Oct 21" for a 'YYYY-MM-DD' day. */
export const shortDay = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "▼ 0.3 kg", "▲ 1.0 kg", "± 0.0 kg". */
export function kgChangeText(kg) {
  const r = Math.round(kg * 10) / 10;
  const arrow = r < 0 ? '▼' : r > 0 ? '▲' : '±';
  return `${arrow} ${Math.abs(r).toFixed(1)} kg`;
}
