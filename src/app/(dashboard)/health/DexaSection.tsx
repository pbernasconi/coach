import Link from 'next/link';
import type { DexaView } from '@/lib/vitals/dexa-queries';

type Measure = DexaView['measures'][number];

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmt = (v: number | null, digits: number) => (v === null ? '-' : v.toFixed(digits));

/** A change with its sign as a glyph, colored by whether it went the good way. Never color alone (the glyph). */
function Change({ m, value, label }: { m: Measure; value: number | null; label: string }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 10 ** -m.digits / 2;
  const good = m.better === null || flat ? null : (value < 0) === (m.better === 'down');
  const color = good === null ? 'var(--viz-muted)' : good ? 'var(--viz-good)' : 'var(--viz-down)';
  const glyph = flat ? '→' : value > 0 ? '▲' : '▼';
  return (
    <span className="whitespace-nowrap tabular-nums" style={{ color }}>
      {glyph} {fmt(Math.abs(value), m.digits)}
      {m.unit === '%' ? ' pts' : m.unit ? ` ${m.unit}` : ''} <span className="text-[var(--viz-muted)]">{label}</span>
    </span>
  );
}

/** The measure across scans: a line with a dot per scan, the latest one filled. */
function Spark({ m }: { m: Measure }) {
  const pts = m.series.filter((p): p is { date: string; value: number } => p.value !== null);
  if (pts.length < 2) return null;
  const W = 120;
  const H = 28;
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const t0 = t(pts[0].date);
  const t1 = t(pts[pts.length - 1].date);
  const vs = pts.map((p) => p.value);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const x = (d: string) => 4 + ((t(d) - t0) / (t1 - t0 || 1)) * (W - 8);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-7 w-full max-w-[120px]" aria-hidden>
      <polyline points={pts.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--viz-ink-2)" strokeWidth="1.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.value)}
          r={i === pts.length - 1 ? 3 : 2}
          fill={i === pts.length - 1 ? 'var(--viz-ink)' : 'var(--viz-surface)'}
          stroke="var(--viz-ink-2)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/** Body composition from BodySpec DEXA scans: the latest values with their change, and every scan in a table. */
export default function DexaSection({ dexa }: { dexa: DexaView }) {
  const { latest, scans, measures } = dexa;
  return (
    <section className="space-y-3" data-dexa>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            <Link href="/health/dexa" className="hover:underline">Body composition</Link>
          </h2>
          {latest && (
            <Link href="/health/dexa" className="text-sm text-muted-foreground hover:text-foreground">
              Body map, regions and every scan →
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {latest
            ? `DEXA scans from BodySpec. ${scans.length} ${scans.length === 1 ? 'scan' : 'scans'}; latest ${fmtDate(latest.scanDate)}${latest.location ? ` at ${latest.location}` : ''}.`
            : 'DEXA scans from BodySpec: body fat, visceral (belly) fat and lean mass per arm.'}
        </p>
      </div>
      {!latest ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No DEXA scans yet.</p>
          <p className="mt-1">
            <Link href="/settings#connections" className="underline underline-offset-4">Connect BodySpec in Settings</Link>. Your scans come in when you connect, and new
            ones every day after.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {measures
              .filter((m) => m.value !== null)
              .map((m) => (
                <li key={m.key} className="relative space-y-1 rounded-lg border bg-[var(--viz-surface)] p-3 hover:border-[var(--viz-axis)]">
                  <Link href="/health/dexa" className="absolute inset-0" aria-label={`${m.label}: body composition page`} />
                  <div className="text-xs text-[var(--viz-muted)]">{m.label}</div>
                  <div className="text-lg font-semibold tabular-nums text-[var(--viz-ink)]">
                    {fmt(m.value, m.digits)}
                    {m.unit && <span className="ml-1 text-xs font-normal text-[var(--viz-muted)]">{m.unit}</span>}
                  </div>
                  <Spark m={m} />
                  <div className="flex flex-col text-xs">
                    <Change m={m} value={m.sincePrevious} label="since last" />
                    <Change m={m} value={m.sinceFirst} label={dexa.first ? `since ${fmtDate(dexa.first.scanDate)}` : ''} />
                  </div>
                </li>
              ))}
          </ul>
          <div className="overflow-x-auto rounded-lg border bg-[var(--viz-surface)]">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-[var(--viz-muted)]">
                  <th className="px-3 py-2 font-medium">Scan</th>
                  {measures.map((m) => (
                    <th key={m.key} className="px-3 py-2 text-right font-medium">
                      {m.label}
                      {m.unit && ` (${m.unit})`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...scans].reverse().map((s, i) => (
                  <tr key={s.resultId} className="border-b last:border-0 hover:bg-[var(--viz-band)]">
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--viz-ink)]">
                      <Link href={`/health/dexa/${s.scanDate}`} className="underline-offset-4 hover:underline">{fmtDate(s.scanDate)}</Link>
                    </td>
                    {measures.map((m) => {
                      const v = m.series[scans.length - 1 - i]?.value ?? null;
                      return (
                        <td key={m.key} className="px-3 py-2 text-right text-[var(--viz-ink)]">
                          {fmt(v, m.digits)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
