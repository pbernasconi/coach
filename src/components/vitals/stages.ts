// Sleep stage labels and colours. A plain module (not 'use client'), so server components can read the values:
// a value exported from a client module is only a reference on the server.
export type Stage = 'deep' | 'light' | 'rem' | 'awake';
export type StageSpan = { start: number; end: number; stage: Stage };

/** Stage colours and labels. Rows also carry the label, so the stage never depends on colour alone. */
export const STAGE_STYLE: Record<Stage, { label: string; color: string }> = {
  awake: { label: 'Awake', color: 'var(--color-amber-500)' },
  rem: { label: 'REM', color: 'var(--viz-atl)' },
  light: { label: 'Light', color: 'color-mix(in oklab, var(--viz-ctl) 50%, var(--viz-surface))' },
  deep: { label: 'Deep', color: 'var(--viz-ctl)' },
};
