import Link from 'next/link';
import { HelpTooltip } from '@kobo/web';
import { ChevronDown, Info } from 'lucide-react';
import type { Biomarker, LabCategory, LabReading } from '@/lib/vitals/queries';
import { slug } from '@/lib/vitals/function-catalog.mjs';
import { pickHighlights, trend } from '@/lib/vitals/labs-highlights.mjs';

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (d: string) => `${new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} '${d.slice(2, 4)}`;
const num = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(+v.toPrecision(3)));
const reading = (r: LabReading) => r.valueText ?? (r.value === null ? '-' : num(r.value));

const STATUS = {
  out_of_range: { label: 'Out of range', color: 'var(--viz-down)' },
  in_range: { label: 'In range', color: 'var(--viz-ink-2)' },
  optimal: { label: 'Optimal', color: 'var(--viz-good)' },
  unknown: { label: 'No range', color: 'var(--viz-muted)' },
} as const;

function rangeText(low: number | null, high: number | null) {
  if (low !== null && high !== null) return `${num(low)}–${num(high)}`;
  if (low !== null) return `≥ ${num(low)}`;
  if (high !== null) return `≤ ${num(high)}`;
  return null;
}

/**
 * The latest value on a scale with the reference range (gray) and the optimal range (green) behind it. Earlier
 * draws are small hollow ticks. Hidden when there is no number or no range to place it against.
 */
function RangeBar({ b }: { b: Biomarker }) {
  const vals = b.history.map((r) => r.value).filter((v): v is number => v !== null);
  const bounds = [b.refLow, b.refHigh, b.optimalLow, b.optimalHigh].filter((v): v is number => v !== null);
  if (b.latest.value === null || bounds.length === 0) return null;
  const min = Math.min(...bounds, ...vals);
  const max = Math.max(...bounds, ...vals);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.2 || 1;
  // A range with only an upper bound ("< 100") starts the scale at 0.
  const lo = b.refLow === null && min >= 0 ? 0 : min - pad;
  const hi = max + pad;
  const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const span = (a: number | null, z: number | null) => ({ left: pct(a ?? lo), width: `calc(${pct(z ?? hi)} - ${pct(a ?? lo)})` });
  const color = STATUS[b.latest.status].color;
  return (
    <div className="relative h-4" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--viz-grid)]" />
      {(b.refLow !== null || b.refHigh !== null) && <div className="absolute inset-y-0.5 rounded-sm bg-[var(--viz-band)] outline outline-1 outline-[var(--viz-grid)]" style={span(b.refLow, b.refHigh)} />}
      {(b.optimalLow !== null || b.optimalHigh !== null) && (
        <div className="absolute inset-y-1 rounded-sm bg-[var(--viz-good)] opacity-25" style={span(b.optimalLow, b.optimalHigh)} />
      )}
      {b.history.slice(0, -1).map((r) =>
        r.value === null ? null : (
          <div key={r.collectedOn} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--viz-muted)] bg-[var(--viz-surface)]" style={{ left: pct(r.value) }} />
        )
      )}
      <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--viz-surface)]" style={{ left: pct(b.latest.value), background: color }} />
    </div>
  );
}

/** The change since the previous draw: glyph and size, green toward the optimal range, red away from it. */
function Trend({ b }: { b: Biomarker }) {
  const t = trend(b);
  if (!t) return <span className="text-xs text-[var(--viz-muted)]">-</span>;
  const flat = Math.abs(t.delta) < Math.abs(t.previous) * 0.005;
  const color = flat || t.better === null ? 'var(--viz-muted)' : t.better ? 'var(--viz-good)' : 'var(--viz-down)';
  return (
    <span className="whitespace-nowrap text-xs tabular-nums" style={{ color }} title={`${num(t.previous)} on ${fmtDate(t.previousOn)}`}>
      {flat ? '→' : t.delta > 0 ? '▲' : '▼'} {flat ? 'steady' : num(Math.abs(t.delta))}{' '}
      <span className="text-[var(--viz-muted)]">vs {shortDate(t.previousOn)}</span>
    </span>
  );
}

/** One line per highlight: name, value (red when out of range), change since the last draw, and the range bar. */
function HighlightRow({ b }: { b: Biomarker }) {
  const out = b.latest.status === 'out_of_range';
  const ref = rangeText(b.refLow, b.refHigh);
  const opt = rangeText(b.optimalLow, b.optimalHigh);
  return (
    <li
      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[minmax(8rem,1fr)_6.5rem_minmax(5rem,1fr)_6.5rem]"
      title={[ref && `Range ${ref}`, opt && `optimal ${opt}`].filter(Boolean).join(' · ') || undefined}
    >
      <Link href={`/health/labs/${slug(b.biomarker)}`} className="truncate text-sm text-[var(--viz-ink)] underline-offset-2 hover:underline">
        {b.biomarker}
      </Link>
      <div className="text-right text-sm tabular-nums sm:text-left" style={{ color: out ? 'var(--viz-down)' : 'var(--viz-ink)' }}>
        {out && <span className="sr-only">Out of range: </span>}
        <b className="font-semibold">{reading(b.latest)}</b> {b.unit && <span className="text-xs text-[var(--viz-muted)]">{b.unit}</span>}
      </div>
      <RangeBar b={b} />
      <div className="text-right sm:text-left">
        <Trend b={b} />
      </div>
    </li>
  );
}

function BiomarkerRow({ b }: { b: Biomarker }) {
  const s = STATUS[b.latest.status];
  const ref = rangeText(b.refLow, b.refHigh);
  const opt = rangeText(b.optimalLow, b.optimalHigh);
  const earlier = b.history.slice(0, -1).reverse();
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(9rem,1.2fr)_minmax(6rem,auto)_minmax(8rem,1.4fr)]">
      <div className="min-w-0">
        <Link href={`/health/labs/${slug(b.biomarker)}`} className="block truncate text-sm font-medium text-[var(--viz-ink)] underline-offset-2 hover:underline">
          {b.biomarker}
        </Link>
        <div className="text-xs text-[var(--viz-muted)]">
          {[ref && `Range ${ref}`, opt && `optimal ${opt}`].filter(Boolean).join(' · ') || 'No reference range'}
        </div>
      </div>
      <div className="text-right sm:text-left">
        <div className="text-sm tabular-nums text-[var(--viz-ink)]">
          <b className="font-semibold">{reading(b.latest)}</b> {b.unit && <span className="text-xs text-[var(--viz-muted)]">{b.unit}</span>}
        </div>
        <div className="flex items-center justify-end gap-1.5 text-xs sm:justify-start" style={{ color: s.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.label}
        </div>
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-1">
        <RangeBar b={b} />
        {earlier.length > 0 && (
          <div className="truncate text-[11px] text-[var(--viz-muted)]">
            Before:{' '}
            {earlier.map((r, i) => (
              <span key={r.collectedOn}>
                {i > 0 && ' · '}
                <span className="tabular-nums" style={{ color: r.status === 'out_of_range' ? 'var(--viz-down)' : undefined }}>{reading(r)}</span> ({fmtDate(r.collectedOn)})
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** The out-of-range and key longevity markers up front; every result by category behind a click. */
export default function LabsSection({ categories, draws }: { categories: LabCategory[]; draws: string[] }) {
  const total = categories.reduce((n, c) => n + c.biomarkers.length, 0);
  const out = categories.reduce((n, c) => n + c.outOfRange, 0);
  const highlights = pickHighlights(categories.flatMap((c) => c.biomarkers));
  return (
    <section className="space-y-3" data-labs>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Labs</h2>
          {total > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {fmtDate(draws[draws.length - 1])} · <span className={out ? 'text-[var(--viz-down)]' : undefined}>{out} out of range</span>
              <HelpTooltip label="About this list" icon={<Info aria-hidden />}>
                Out-of-range results, then the markers that matter most for heart, metabolic and brain health (ApoB, Lp(a),
                LDL, triglycerides, HbA1c, insulin, hs-CRP, homocysteine, omega-3, vitamin D, B12). Red values are out of
                range. The bar shows the reference range (gray) and optimal range (green); hollow dots are earlier draws.
                The change is since the previous draw: green toward the optimal range, red away from it. {total} results from{' '}
                {draws.length} {draws.length === 1 ? 'draw' : 'draws'} in all.
              </HelpTooltip>
            </span>
          )}
        </div>
        {total > 0 && <Link href="/health/labs" className="text-sm text-brand-ink underline-offset-4 hover:underline">Full report →</Link>}
      </div>
      {total === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No lab results yet.</p>
          <p className="mt-1">
            Run <code className="rounded bg-muted px-1">/labs</code> in Claude Code in the coach repository. It reads every result from the Function
            Health connector (or from a Function PDF export) and imports them into Coach. Run it again after each new draw.
          </p>
        </div>
      ) : (
        <>
          {highlights.length > 0 && (
            <ul className="grid divide-y rounded-lg border bg-[var(--viz-surface)] px-4 lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0 lg:[&>li]:border-b lg:[&>li:nth-last-child(-n+2)]:border-b-0">
              {highlights.map(({ b }) => <HighlightRow key={b.biomarker} b={b} />)}
            </ul>
          )}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              All {total} results
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {categories.map((c) => (
                <div key={c.category} className="rounded-lg border bg-[var(--viz-surface)] p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-[var(--viz-ink)]">{c.category}</h3>
                    <span className="text-xs text-[var(--viz-muted)]">
                      {c.outOfRange ? <span className="text-[var(--viz-down)]">{c.outOfRange} out of range</span> : 'All in range'} · {c.biomarkers.length}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {c.biomarkers.map((b) => <BiomarkerRow key={b.biomarker} b={b} />)}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
