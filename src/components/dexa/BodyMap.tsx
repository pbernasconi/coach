import type { FullScan } from '@/lib/vitals/dexa.mjs';

type Region = FullScan['regions'][number];

// A front view, as a DEXA image shows it: the patient's right side on the viewer's left. 280 × 420 units.
const SHAPES: Record<string, string> = {
  trunk: 'M102,80 C110,74 170,74 178,80 L182,120 C180,150 176,170 176,190 L180,222 L100,222 L104,190 C104,170 100,150 98,120 Z',
  right_arm: 'M100,80 C88,82 81,95 79,115 L73,175 L67,236 C66,246 77,248 79,238 L86,178 L94,128 Z',
  left_arm: 'M180,80 C192,82 199,95 201,115 L207,175 L213,236 C214,246 203,248 201,238 L194,178 L186,128 Z',
  right_leg: 'M102,225 L139,225 L136,300 L132,392 C132,400 112,400 112,392 L108,300 Z',
  left_leg: 'M141,225 L178,225 L172,300 L168,392 C168,400 148,400 148,392 L144,300 Z',
};
const BANDS = { android: { y: 168, h: 26 }, gynoid: { y: 206, h: 46 } } as const;

/** Where each region's value is written, and how the text is anchored. */
const LABELS: Record<string, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
  right_arm: { x: 60, y: 150, anchor: 'end' },
  left_arm: { x: 220, y: 150, anchor: 'start' },
  trunk: { x: 140, y: 128, anchor: 'middle' },
  android: { x: 220, y: 185, anchor: 'start' },
  gynoid: { x: 220, y: 233, anchor: 'start' },
  right_leg: { x: 100, y: 330, anchor: 'end' },
  left_leg: { x: 180, y: 330, anchor: 'start' },
};
const SHORT: Record<string, string> = { right_arm: 'R arm', left_arm: 'L arm', trunk: 'Trunk', android: 'Belly', gynoid: 'Hips', right_leg: 'R leg', left_leg: 'L leg' };

export type BodyMapMode =
  | { kind: 'fat' }
  | { kind: 'change'; previous: FullScan; field: 'leanKg' | 'fatKg' };

/** The fill for a fat %: from the band colour at 8% to full --dexa-fat at 32%. */
function fatFill(pct: number | null) {
  if (pct === null) return 'var(--viz-band)';
  const t = Math.max(0, Math.min(1, (pct - 8) / 24));
  return `color-mix(in oklab, var(--dexa-fat) ${Math.round(8 + t * 87)}%, var(--viz-band))`;
}

/** The fill for a change: green for the good direction, red for the other, stronger with size (0.5 kg is full). */
function changeFill(delta: number | null, good: 'up' | 'down') {
  if (delta === null || Math.abs(delta) < 0.005) return 'var(--viz-band)';
  const isGood = (delta > 0) === (good === 'up');
  const t = Math.min(1, Math.abs(delta) / 0.5);
  return `color-mix(in oklab, ${isGood ? 'var(--viz-good)' : 'var(--viz-down)'} ${Math.round(18 + t * 62)}%, var(--viz-band))`;
}

const signed = (v: number, d: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;

/**
 * The body split into DEXA regions and shaded: fat % per region, or the change of lean or fat mass since another
 * scan. Each region is labelled with its value; the belly (android) and hip (gynoid) boxes are outlined.
 */
export default function BodyMap({ scan, mode = { kind: 'fat' }, title }: { scan: FullScan; mode?: BodyMapMode; title: string }) {
  const byKey = Object.fromEntries(scan.regions.map((r) => [r.key, r]));
  const before = mode.kind === 'change' ? Object.fromEntries(mode.previous.regions.map((r) => [r.key, r])) : {};
  const value = (key: string): { fill: string; text: string } | null => {
    const r: Region | undefined = byKey[key];
    if (!r) return null;
    if (mode.kind === 'fat') return { fill: fatFill(r.fatPct), text: r.fatPct === null ? '–' : `${r.fatPct.toFixed(1)}%` };
    const now = r[mode.field];
    const then = before[key]?.[mode.field] ?? null;
    const delta = now === null || then === null ? null : now - then;
    return { fill: changeFill(delta, mode.field === 'leanKg' ? 'up' : 'down'), text: delta === null ? '–' : `${signed(delta, 2)} kg` };
  };
  const described = scan.regions
    .filter((r) => LABELS[r.key])
    .map((r) => `${r.label} ${value(r.key)?.text ?? 'n/a'}`)
    .join(', ');

  return (
    <figure className="space-y-1">
      <svg viewBox="0 0 280 410" className="mx-auto h-auto w-full max-w-[300px]" role="img" aria-label={`${title}: ${described}`}>
        <circle cx="140" cy="42" r="24" fill="var(--viz-band)" stroke="var(--viz-axis)" strokeWidth="1" />
        <rect x="131" y="62" width="18" height="16" rx="4" fill="var(--viz-band)" stroke="var(--viz-axis)" strokeWidth="1" />
        {Object.entries(SHAPES).map(([key, d]) => (
          <path key={key} d={d} fill={value(key)?.fill ?? 'var(--viz-band)'} stroke="var(--viz-surface)" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {(['android', 'gynoid'] as const).map((key) => {
          const v = value(key);
          if (!v) return null;
          const b = BANDS[key];
          return (
            <g key={key}>
              <rect x="104" y={b.y} width="72" height={b.h} rx="6" fill={v.fill} fillOpacity="0.55" stroke="var(--viz-ink-2)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="176" x2="216" y1={b.y + b.h / 2} y2={LABELS[key].y - 4} stroke="var(--viz-axis)" strokeWidth="1" />
            </g>
          );
        })}
        <text x="74" y="22" className="fill-[var(--viz-muted)] text-[11px]" textAnchor="middle">R</text>
        <text x="206" y="22" className="fill-[var(--viz-muted)] text-[11px]" textAnchor="middle">L</text>
        {Object.entries(LABELS).map(([key, l]) => {
          const v = value(key);
          if (!v) return null;
          return (
            <text key={key} x={l.x} y={l.y} textAnchor={l.anchor} className="text-[12px] tabular-nums" style={{ paintOrder: 'stroke' }} stroke="var(--viz-surface)" strokeWidth={key === 'trunk' ? 3 : 0}>
              <tspan x={l.x} className="fill-[var(--viz-muted)] text-[10px]">{SHORT[key]}</tspan>
              <tspan x={l.x} dy="14" className="fill-[var(--viz-ink)] font-semibold">{v.text}</tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="text-center text-xs text-[var(--viz-muted)]">{title}</figcaption>
    </figure>
  );
}
