import type { Tone } from '@/lib/vitals/dexa-health.mjs';

/** The band fill of a healthy-range zone: soft status colours (green, amber, red) or a neutral band. */
export const ZONE_FILL: Record<Tone, string> = {
  good: 'color-mix(in oklab, var(--viz-good) 16%, transparent)',
  warn: 'color-mix(in oklab, var(--viz-warn) 20%, transparent)',
  bad: 'color-mix(in oklab, var(--viz-down) 14%, transparent)',
  neutral: 'var(--viz-band)',
  strong: 'color-mix(in oklab, var(--dexa-lean) 16%, transparent)',
};

/** The ink of a zone's label and status text (readable on the surface). */
export const ZONE_INK: Record<Tone, string> = {
  good: 'var(--viz-up)',
  warn: 'var(--viz-warn-ink)',
  bad: 'var(--viz-down)',
  neutral: 'var(--viz-ink-2)',
  strong: 'var(--dexa-lean)',
};

/** A status chip in a zone's colours. The words carry the meaning. */
export function ZoneChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: ZONE_FILL[tone], color: ZONE_INK[tone] }}>
      {children}
    </span>
  );
}

export const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const monthYY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");
