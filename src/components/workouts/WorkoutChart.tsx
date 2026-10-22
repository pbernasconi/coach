'use client';

import { useRef, useState } from 'react';
import { ANCHORS, STEP_KIND, clock, flatten, intensity, stepLength, stepSeconds, stepTarget, zoneOf } from '@/lib/workouts/steps.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';

type Step = {
  kind: string;
  duration: { type: string; s?: number; m?: number };
  target: { type: string; low?: number; high?: number };
  ramp?: boolean;
  cadence?: [number, number];
  notes?: string;
  rep?: string;
};

/** Zone colors, as in TrainingPeaks and Zwift: grey, blue, green, yellow, red. */
export const ZONE_COLOR: Record<string, string> = { Z1: '#9ca3af', Z2: '#3b82f6', Z3: '#22c55e', Z4: '#f59e0b', Z5: '#ef4444' };

type Bar = { step: Step; start: number; secs: number; lo: number; hi: number; mid: number; zone: string };

/** The steps as bars: start and length in seconds, the low / high / middle intensity (1 = FTP or LTHR) and zone. */
function barsOf(workout: StructuredWorkout) {
  const flat = flatten(workout.steps as never[]) as Step[];
  let t = 0;
  const bars: Bar[] = flat.map((s) => {
    const secs = Math.max(stepSeconds(s as never), s.duration.type === 'lap' ? 300 : 0);
    const open = s.target.type === 'open' || s.target.type === 'pace';
    const bar = {
      step: s,
      start: t,
      secs,
      lo: open ? 0.5 : (s.target.low ?? 50) / 100,
      hi: open ? 0.5 : (s.target.high ?? 50) / 100,
      mid: open ? (s.kind === 'work' ? 1.1 : 0.5) : (intensity(s.target as never) ?? 0.5),
      zone: open && s.kind === 'work' ? 'Z5' : zoneOf(s.target as never, workout.sport),
    };
    t += secs;
    return bar;
  });
  return { bars, total: t || 1, top: Math.max(1.25, ...bars.map((b) => b.hi)) };
}

function Polygons({ bars, total, top, height, active, mono }: { bars: Bar[]; total: number; top: number; height: number; active?: number | null; mono?: boolean }) {
  const W = 1000;
  const y = (f: number) => height - (Math.min(f, top) / top) * height;
  return (
    <>
      {bars.map((b, i) => {
        const x0 = (b.start / total) * W;
        const w = (b.secs / total) * W;
        const gap = w > 3 ? 0.6 : 0;
        const points = b.step.ramp
          ? `${x0 + gap},${height} ${x0 + gap},${y(b.lo)} ${x0 + w - gap},${y(b.hi)} ${x0 + w - gap},${height}`
          : `${x0 + gap},${height} ${x0 + gap},${y(b.mid)} ${x0 + w - gap},${y(b.mid)} ${x0 + w - gap},${height}`;
        const dim = active != null && active !== i;
        return <polygon key={i} points={points} fill={mono ? 'currentColor' : ZONE_COLOR[b.zone]} opacity={dim ? 0.35 : mono ? 0.45 : 0.9} className="transition-opacity duration-100" />;
      })}
    </>
  );
}

/** The y-axis ticks: % of the anchor, labelled in watts (rides) or beats (runs). */
function ticksFor(sport: string, top: number) {
  const anchor = sport === 'ride' ? ANCHORS.ftp : ANCHORS.lthr;
  const steps = sport === 'ride' ? [0.5, 0.75, 1, 1.25, 1.5] : [0.6, 0.8, 1, 1.2];
  return steps.filter((f) => f < top - 0.05).map((f) => ({ f, label: String(Math.round(f * anchor)) }));
}

const at = (s: number) => (s === 0 ? '0:00' : clock(s));

const pct = (b: Bar, sport: string) => {
  const t = b.step.target;
  if (t.type !== 'power' && t.type !== 'hr') return null;
  return `${t.low}–${t.high}% ${sport === 'ride' ? 'FTP' : 'LTHR'}`;
};

/**
 * The workout as an interval chart: one bar per step, its width the time and its height the intensity, colored by
 * zone. A ramp is a slope. The y-axis is in watts (rides) or beats (runs), with the FTP / LTHR line dashed. Hover a
 * bar for the step. Distance steps are drawn at an estimated pace.
 */
export default function WorkoutChart({ workout, height = 120, className }: { workout: StructuredWorkout; height?: number; className?: string }) {
  const { bars, total, top } = barsOf(workout);
  // With a className (the Today page): the compact chart, bars and the FTP / LTHR line only, at that size.
  if (className) {
    const ftp = height - (1 / top) * height;
    return (
      <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`${workout.name}: interval chart`}>
        <line x1={0} x2={1000} y1={ftp} y2={ftp} stroke="var(--viz-axis)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <Polygons bars={bars} total={total} top={top} height={height} />
      </svg>
    );
  }
  return <DetailedChart workout={workout} height={height} bars={bars} total={total} top={top} />;
}

function DetailedChart({ workout, height, bars, total, top }: { workout: StructuredWorkout; height: number; bars: Bar[]; total: number; top: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const ticks = ticksFor(workout.sport, top);
  const yPct = (f: number) => (1 - Math.min(f, top) / top) * 100;

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const t = ((clientX - r.left) / r.width) * total;
    const i = bars.findIndex((b) => t >= b.start && t < b.start + b.secs);
    setHover(i >= 0 ? i : null);
  };

  const h = hover != null ? bars[hover] : null;
  const left = h ? ((h.start + h.secs / 2) / total) * 100 : 0;

  return (
    <div className="flex gap-2">
      <div className="relative w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--viz-muted)]" style={{ height }} aria-hidden>
        {ticks.map((t) => (
          <span key={t.f} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${yPct(t.f)}%` }}>
            {t.label}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className="relative min-w-0 flex-1"
        style={{ height }}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
      >
        <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={`${workout.name}: interval chart`}>
          {ticks.map((t) => (
            <line
              key={t.f}
              x1={0}
              x2={1000}
              y1={(yPct(t.f) / 100) * height}
              y2={(yPct(t.f) / 100) * height}
              stroke="var(--viz-axis)"
              strokeDasharray={t.f === 1 ? '4 4' : undefined}
              strokeOpacity={t.f === 1 ? 1 : 0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <Polygons bars={bars} total={total} top={top} height={height} active={hover} />
        </svg>
        <span className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[10px] leading-none text-[var(--viz-muted)]" style={{ top: `${yPct(1)}%` }}>
          {workout.sport === 'ride' ? `FTP ${ANCHORS.ftp} W` : `LTHR ${ANCHORS.lthr} bpm`}
        </span>
        {h && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[16rem] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
            style={{ left: `${left}%`, transform: `translateX(${left < 20 ? '-10%' : left > 80 ? '-90%' : '-50%'})` }}
          >
            <p className="flex items-center gap-1.5 font-medium text-[var(--viz-ink)]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: ZONE_COLOR[h.zone] }} />
              {STEP_KIND[h.step.kind as keyof typeof STEP_KIND] ?? h.step.kind}
              {h.step.rep && <span className="font-normal text-[var(--viz-muted)]">· {h.step.rep.replace('/', ' of ')}</span>}
              <span className="ml-auto pl-3 font-normal text-[var(--viz-muted)]">{h.zone}</span>
            </p>
            <p className="mt-1 tabular-nums text-[var(--viz-ink)]">
              <b className="font-semibold">{stepLength(h.step as never)}</b> · {stepTarget(h.step as never)}
            </p>
            <p className="tabular-nums text-[var(--viz-muted)]">
              {[pct(h, workout.sport), `${at(h.start)} → ${at(h.start + h.secs)}`].filter(Boolean).join(' · ')}
            </p>
            {h.step.notes && <p className="mt-1 text-[var(--viz-ink-2)]">{h.step.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** A small structure chart for a calendar card: grey bars only (the card already carries the sport and status colours). */
export function MiniWorkoutChart({ workout, className }: { workout: StructuredWorkout; className?: string }) {
  const { bars, total, top } = barsOf(workout);
  return (
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className={className} aria-hidden>
      <Polygons bars={bars} total={total} top={top} height={40} mono />
    </svg>
  );
}
