'use client';

import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Footprints, Gauge, HeartPulse, Moon, Zap } from 'lucide-react';
import { loadHealthGlance } from '@/app/(dashboard)/plan/actions';
import { STAGE_STYLE, type Stage } from '@/components/vitals/stages';
import type { DayGlance } from '@/lib/vitals/day-glance';

// One request per day while the page is open. A failed request is removed so a later hover tries again.
const cache = new Map<string, Promise<DayGlance | null>>();
function glance(date: string) {
  let p = cache.get(date);
  if (!p) {
    p = loadHealthGlance(date).catch((e) => {
      cache.delete(date);
      throw e;
    });
    cache.set(date, p);
  }
  return p;
}

/**
 * The heart on a past day of the plan calendar. A click opens /health/day/<date>. Hover or focus shows the
 * day's Garmin card: training readiness, sleep stages, HRV, resting heart rate, Body Battery, stress and steps.
 */
export default function HealthBadge({ date, label, className }: { date: string; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [el, setEl] = useState<HTMLAnchorElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();
  const show = (on: boolean, wait = 80) => {
    clearTimeout(timer.current);
    if (on) void glance(date).catch(() => {}); // start the request while the delay runs
    timer.current = setTimeout(() => setOpen(on), wait);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!(e instanceof KeyboardEvent) || e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <Link
        ref={setEl}
        href={`/health/day/${date}`}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => show(true)}
        onMouseLeave={() => show(false)}
        onFocus={() => show(true, 0)}
        onBlur={() => show(false, 0)}
        className={className}
      >
        <HeartPulse aria-hidden className="h-3 w-3" />
      </Link>
      {open && el && createPortal(<HealthCard id={id} date={date} anchor={el} />, document.body)}
    </>
  );
}

const W = 320;

function HealthCard({ id, date, anchor }: { id: string; date: string; anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ g: DayGlance | null; error: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let live = true;
    glance(date).then(
      (g) => live && setState({ g, error: false }),
      () => live && setState({ g: null, error: true })
    );
    return () => {
      live = false;
    };
  }, [date]);

  // Under the heart, or over it when there is no room; inside the window. Placed again when the content changes.
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 0;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, a.left - 12), vw - W - 8);
    const below = a.bottom + 6;
    const top = below + h > vh - 8 && a.top - 6 - h > 8 ? a.top - 6 - h : Math.max(8, Math.min(below, vh - h - 8));
    setPos({ left: Math.max(8, left), top });
  }, [anchor, state]);

  const g = state?.g;
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-xl border bg-[var(--viz-surface)] p-3.5 text-xs shadow-lg"
      style={{ width: W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-[var(--viz-ink-2)]">{longDay(date)}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--viz-muted)]">Garmin</span>
      </div>
      {!state ? (
        <Skeleton />
      ) : state.error ? (
        <p className="mt-3 text-[var(--viz-muted)]">Could not load this day. Click the heart to open it.</p>
      ) : !g || !g.hasData ? (
        <p className="mt-3 text-[var(--viz-muted)]">No Garmin data for this day.</p>
      ) : (
        <Body g={g} />
      )}
      <div className="mt-3 border-t pt-2 text-[10px] text-[var(--viz-muted)]">Click the heart for the full day</div>
    </div>
  );
}

function Body({ g }: { g: DayGlance }) {
  const s = g.sleep;
  return (
    <>
      <div className="mt-3 flex items-center gap-3.5">
        <Ring score={g.readiness?.score ?? null} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          <Hero label="Sleep" value={s?.totalMin != null ? hm(s.totalMin) : '–'} sub={s?.score != null ? `score ${Math.round(s.score)}` : null} />
          <Hero label="HRV" value={g.hrv ? `${g.hrv.avg}` : '–'} unit={g.hrv ? 'ms' : undefined} sub={g.hrv?.status ?? null} tone={hrvTone(g.hrv)} />
          <Hero label="Resting HR" value={g.restingHr != null ? `${Math.round(g.restingHr)}` : '–'} unit={g.restingHr != null ? 'bpm' : undefined} />
        </div>
      </div>
      {g.readiness?.feedback && <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[var(--viz-ink-2)]">{g.readiness.feedback}</p>}

      {s && s.stages.length > 0 && s.start != null && s.end != null && (
        <Section icon={Moon} title="Sleep" note={`${clock(s.start)} – ${clock(s.end)}`}>
          <StageStrip stages={s.stages} from={s.start} to={s.end} />
          {s.minutes && <StageLegend m={s.minutes} />}
        </Section>
      )}

      {g.bodyBattery && (
        <Section
          icon={Zap}
          title="Body Battery"
          note={
            [
              g.bodyBattery.high != null ? `high ${g.bodyBattery.high} · low ${g.bodyBattery.low ?? '–'}` : null,
              g.bodyBattery.charged != null ? `+${g.bodyBattery.charged} / −${g.bodyBattery.drained ?? '–'}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
        >
          <BatteryChart date={g.date} b={g.bodyBattery} />
        </Section>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2.5">
        <Small icon={Gauge} label="Stress" value={g.stressAvg != null ? `${Math.round(g.stressAvg)}` : '–'} sub={g.stressAvg != null ? stressWord(g.stressAvg) : null} />
        <Small
          icon={Footprints}
          label="Steps"
          value={g.steps != null ? g.steps.toLocaleString('en-US') : '–'}
          sub={g.steps != null && g.stepGoal ? `${Math.round((g.steps / g.stepGoal) * 100)}% of goal` : null}
        />
        <Small icon={Activity} label="Intensity" value={g.intensityMin != null ? `${Math.round(g.intensityMin)}` : '–'} sub={g.intensityMin != null ? 'minutes' : null} />
      </div>
    </>
  );
}

/** Training readiness 0–100 as a ring with the score in the middle. */
function Ring({ score }: { score: number | null }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const color = score == null ? 'var(--viz-muted)' : score >= 75 ? 'var(--viz-good)' : score >= 50 ? 'var(--viz-ctl)' : score >= 25 ? 'var(--color-amber-500)' : 'var(--viz-down)';
  return (
    <div className="relative h-[60px] w-[60px] shrink-0">
      <svg width={60} height={60} viewBox="0 0 60 60" aria-hidden className="-rotate-90">
        <circle cx={30} cy={30} r={r} fill="none" stroke="var(--viz-band)" strokeWidth={5} />
        {score != null && (
          <circle cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * c} ${c}`} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-semibold tabular-nums text-[var(--viz-ink)]">{score ?? '–'}</span>
        <span className="mt-0.5 text-[8px] uppercase tracking-wide text-[var(--viz-muted)]">Ready</span>
      </div>
    </div>
  );
}

function Hero({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string | null; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-[var(--viz-muted)]">{label}</div>
      <div className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-[var(--viz-ink)]">
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-[var(--viz-muted)]">{unit}</span>}
      </div>
      {sub && (
        <div className="truncate text-[10px]" style={{ color: tone ?? 'var(--viz-ink-2)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Small({ icon: Icon, label, value, sub }: { icon: typeof Gauge; label: string; value: string; sub?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-[var(--viz-muted)]">
        <Icon aria-hidden className="h-3 w-3" /> {label}
      </div>
      <div className="text-[13px] font-semibold tabular-nums text-[var(--viz-ink)]">{value}</div>
      {sub && <div className="truncate text-[10px] text-[var(--viz-ink-2)]">{sub}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, note, children }: { icon: typeof Moon; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1 font-medium text-[var(--viz-ink-2)]">
          <Icon aria-hidden className="h-3 w-3 text-[var(--viz-muted)]" /> {title}
        </span>
        {note && <span className="tabular-nums text-[var(--viz-muted)]">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function StageLegend({ m }: { m: Record<Stage, number> }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--viz-ink-2)]">
      {(['deep', 'light', 'rem', 'awake'] as Stage[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: STAGE_STYLE[k].color }} />
          {STAGE_STYLE[k].label} <b className="font-semibold tabular-nums text-[var(--viz-ink)]">{hm(m[k])}</b>
        </span>
      ))}
    </div>
  );
}

const ROWS: Stage[] = ['awake', 'rem', 'light', 'deep'];

/** A small hypnogram: one lane per stage, awake on top. */
function StageStrip({ stages, from, to }: { stages: { start: number; end: number; stage: Stage }[]; from: number; to: number }) {
  const width = W - 28;
  const laneH = 7;
  const gap = 2;
  const height = ROWS.length * (laneH + gap) - gap;
  const span = Math.max(1, to - from);
  const x = (t: number) => ((Math.min(to, Math.max(from, t)) - from) / span) * width;
  return (
    <svg width={width} height={height} aria-hidden className="block">
      {ROWS.map((r, i) => (
        <rect key={r} x={0} y={i * (laneH + gap)} width={width} height={laneH} rx={2} fill="var(--viz-band)" opacity={0.5} />
      ))}
      {stages.map((s, i) => {
        const x0 = x(s.start);
        const w = Math.max(1, x(s.end) - x0);
        return <rect key={i} x={x0} y={ROWS.indexOf(s.stage) * (laneH + gap)} width={w} height={laneH} rx={1.5} fill={STAGE_STYLE[s.stage].color} />;
      })}
    </svg>
  );
}

/** Body Battery through the day as an area, with the high and the low marked. */
function BatteryChart({ date, b }: { date: string; b: NonNullable<DayGlance['bodyBattery']> }) {
  const pts = b.points;
  const width = W - 28;
  const top = 12;
  const plotH = 40;
  const height = top + plotH + 13;
  if (pts.length < 2) {
    return (
      <div className="text-[11px] text-[var(--viz-ink-2)]">
        High <b className="tabular-nums text-[var(--viz-ink)]">{b.high ?? '–'}</b> · low <b className="tabular-nums text-[var(--viz-ink)]">{b.low ?? '–'}</b>
      </div>
    );
  }
  const day0 = Date.parse(`${date}T00:00:00Z`);
  const from = Math.min(day0, pts[0].t);
  const to = Math.max(day0 + 24 * 3600_000, pts[pts.length - 1].t);
  const x = (t: number) => ((t - from) / (to - from)) * width;
  const y = (v: number) => top + ((100 - v) / 100) * plotH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(pts[pts.length - 1].t).toFixed(1)},${top + plotH}L${x(pts[0].t).toFixed(1)},${top + plotH}Z`;
  const hiP = pts.reduce((a, p) => (p.v > a.v ? p : a), pts[0]);
  const loP = pts.reduce((a, p) => (p.v < a.v ? p : a), pts[0]);
  const gid = `bb-${date}`;
  const clampX = (v: number) => Math.min(width - 10, Math.max(10, v));
  // The low's label goes under its point when the high's label is near, so the two never overlap.
  const near = Math.abs(x(hiP.t) - x(loP.t)) < 32;
  const lowLabelY = near ? Math.min(top + plotH + 1, y(loP.v) + 12) : y(loP.v) - 4;
  return (
    <svg width={width} height={height} aria-hidden className="block">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--viz-ctl)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--viz-ctl)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {[6, 12, 18].map((h) => {
        const gx = x(day0 + h * 3600_000);
        return <line key={h} x1={gx} x2={gx} y1={top} y2={top + plotH} stroke="var(--viz-grid)" strokeWidth={1} />;
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--viz-ctl)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(hiP.t)} cy={y(hiP.v)} r={2.5} fill="var(--viz-ctl)" />
      <text x={clampX(x(hiP.t))} y={y(hiP.v) - 4} textAnchor="middle" className="fill-[var(--viz-ink)] text-[10px] font-semibold">
        {hiP.v}
      </text>
      {loP !== hiP && (
        <>
          <circle cx={x(loP.t)} cy={y(loP.v)} r={2.5} fill="var(--viz-surface)" stroke="var(--viz-ctl)" strokeWidth={1.5} />
          <text x={clampX(x(loP.t))} y={lowLabelY} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
            {loP.v}
          </text>
        </>
      )}
      {[
        [6, '6a'],
        [12, '12p'],
        [18, '6p'],
      ].map(([h, l]) => (
        <text key={h} x={x(day0 + Number(h) * 3600_000)} y={height - 1} textAnchor="middle" className="fill-[var(--viz-muted)] text-[10px]">
          {l}
        </text>
      ))}
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="mt-3 animate-pulse space-y-3" aria-label="Loading">
      <div className="flex items-center gap-3.5">
        <div className="h-[60px] w-[60px] rounded-full bg-[var(--viz-band)]" />
        <div className="grid flex-1 grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 w-8 rounded bg-[var(--viz-band)]" />
              <div className="h-4 w-12 rounded bg-[var(--viz-band)]" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-8 rounded bg-[var(--viz-band)]" />
      <div className="h-12 rounded bg-[var(--viz-band)]" />
    </div>
  );
}

function hrvTone(h: DayGlance['hrv']) {
  if (!h || h.low == null || h.high == null) return undefined;
  return h.avg < h.low ? 'var(--color-amber-600, #d97706)' : h.avg > h.high ? 'var(--viz-ctl)' : 'var(--viz-good)';
}

const stressWord = (v: number) => (v <= 25 ? 'rest' : v <= 50 ? 'low' : v <= 75 ? 'medium' : 'high');
const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
// Garmin times are "local ms": the local clock written as UTC.
const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

function longDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
