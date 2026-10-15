/** Display helpers for the Lift dashboard. Plain numbers and labels only. */

export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatWeight(value: number | null, unit: string, digits = 1): string {
  if (value === null) return '-';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}`;
}

export function formatVolume(value: number, unit: string): string {
  return `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}
