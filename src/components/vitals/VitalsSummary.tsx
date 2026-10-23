import { HelpTooltip } from '@kobo/web';
import { Info } from 'lucide-react';
import type { Board } from '@/lib/vitals/garmin-pages';
import type { Readiness } from '@/lib/vitals/queries';

type Stat = Board['stats']['hrv'];

const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const VERDICT = {
  good: { label: 'Ready', color: 'var(--viz-good)', text: 'HRV, resting heart rate and sleep are all near your normal.' },
  ok: { label: 'One flag', color: 'var(--color-amber-500)', text: 'One signal is off. Keep the plan, but watch how the session feels.' },
  low: { label: 'Take it easy', color: 'var(--viz-down)', text: 'Several signals are off. An easier day is a good idea.' },
  unknown: { label: 'Not enough data', color: 'var(--viz-muted)', text: 'Readiness needs HRV or resting heart rate with 14 days of history, or last night’s sleep.' },
} as const;

type Cell = { key: string; label: string; stat: Stat; fmt: (v: number) => string; unit: string; bad?: 'low' | 'high'; foot?: string };

/** Where the value sits against its normal range: a short track, the range shaded, the value as a tick. */
function RangeBar({ stat, bad }: { stat: Stat; bad?: 'low' | 'high' }) {
  if (!stat.latest || !stat.normal) return <div className="mt-1.5 h-1.5" />;
  const { low, high } = stat.normal;
  const span = high - low;
  const lo = Math.min(low - span, stat.latest.value);
  const hi = Math.max(high + span, stat.latest.value);
  const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const off = (bad === 'low' && stat.status === 'below') || (bad === 'high' && stat.status === 'above');
  return (
    <div className="relative mt-1.5 h-1.5 rounded-full bg-[var(--viz-grid)]" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-[var(--viz-axis)]" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
      <div
        className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-full"
        style={{ left: pct(stat.latest.value), background: off ? 'var(--viz-down)' : 'var(--viz-ink)' }}
      />
    </div>
  );
}

/**
 * The top of /health: the readiness verdict and one compact row of the latest values, each against its normal range
 * (mean ± 1 SD of the 60 days before it). Colour only marks a value outside that range.
 */
export default function VitalsSummary({ r, b }: { r: Readiness; b: Board }) {
  const v = VERDICT[r.status];
  const st = b.stats;
  const cells: Cell[] = [
    { key: 'hrv', label: 'HRV', stat: st.hrv, fmt: (x) => String(Math.round(x)), unit: 'ms', bad: 'low' },
    { key: 'rhr', label: 'Resting HR', stat: st.rhr, fmt: (x) => String(Math.round(x)), unit: 'bpm', bad: 'high' },
    { key: 'sleep', label: 'Sleep', stat: st.sleep, fmt: hm, unit: 'h', bad: 'low' },
    { key: 'score', label: 'Sleep score', stat: st.sleepScore, fmt: (x) => String(Math.round(x)), unit: '', bad: 'low' },
    { key: 'bb', label: 'Body Battery', stat: st.bbHigh, fmt: (x) => String(Math.round(x)), unit: 'peak', bad: 'low' },
    { key: 'ready', label: 'Readiness', stat: st.readiness, fmt: (x) => String(Math.round(x)), unit: '', bad: 'low' },
    { key: 'stress', label: 'Stress', stat: st.stress, fmt: (x) => String(Math.round(x)), unit: 'avg', bad: 'high' },
    {
      key: 'weight',
      label: 'Weight',
      stat: { ...st.weight, normal: null, status: null },
      fmt: (x) => x.toFixed(1),
      unit: 'kg',
      foot: !st.weight.latest
        ? undefined
        : st.weight.trend
          ? [`trend ${st.weight.trend.text}`, st.weight.trend.rate?.text.replace(' kg/wk', '/wk')].filter(Boolean).join(' · ')
          : fmtDay(st.weight.latest.date),
    },
  ];
  const isOff = (c: { bad?: 'low' | 'high'; stat: Stat }) => (c.bad === 'low' && c.stat.status === 'below') || (c.bad === 'high' && c.stat.status === 'above');
  const outliers = cells.filter(isOff);
  const stale = (d: string) => d < b.days[b.days.length - 2]; // older than yesterday

  return (
    <section className="rounded-lg border bg-[var(--viz-surface)]" data-smoke="health-vitals">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5">
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--viz-ink)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
          {v.label}
          <HelpTooltip label="About readiness" icon={<Info aria-hidden />}>
            {v.text} Each value below is compared with your own normal range: the middle of your last 60 days.
          </HelpTooltip>
        </span>
        <span className="text-sm text-[var(--viz-ink-2)]">
          {outliers.length === 0 ? 'All within your normal' : `Outside your normal: ${outliers.map((c) => `${c.label} ${c.stat.status === 'above' ? 'high' : 'low'}`).join(', ')}`}
        </span>
        {r.flags.length > 0 && <span className="text-sm text-[var(--viz-muted)]">· {r.flags.join(' · ')}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-[var(--viz-grid)] sm:grid-cols-4 xl:grid-cols-8">
        {cells.map((c) => {
          const l = c.stat.latest;
          const off = isOff(c);
          return (
            <div key={c.key} className="min-w-0 bg-[var(--viz-surface)] px-4 py-3">
              <dt className="truncate text-xs text-[var(--viz-muted)]">{c.label}</dt>
              <dd>
                <span className={`text-xl font-semibold tabular-nums tracking-tight ${l ? (off ? 'text-[var(--viz-down)]' : 'text-[var(--viz-ink)]') : 'text-[var(--viz-muted)]'}`}>
                  {l ? c.fmt(l.value) : '–'}
                </span>
                {l && c.unit && <span className="ml-1 text-xs text-[var(--viz-muted)]">{c.unit}</span>}
                <RangeBar stat={c.stat} bad={c.bad} />
                <div className="mt-1 truncate text-[11px] tabular-nums text-[var(--viz-muted)]">
                  {!l
                    ? 'No data'
                    : c.foot ?? (c.stat.normal ? `normal ${c.fmt(c.stat.normal.low)}–${c.fmt(c.stat.normal.high)}` : 'building normal')}
                  {l && c.key !== 'weight' && stale(l.date) && <span className="ml-1 text-[var(--color-amber-600)]">· {fmtDay(l.date)}</span>}
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
