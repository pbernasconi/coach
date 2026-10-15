import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail } from '@/lib/lift-dashboard/stats.mjs';
import { formatDay, formatShortDay, formatWeight } from '@/lib/lift-dashboard/format';

export const dynamic = 'force-dynamic';

type Point = { day: string; e1rm: number; reps: number | null; weight: number | null };

/** A single-series line of estimated 1RM per session. Each point has a native tooltip; the table below
 * carries the same numbers. */
function E1rmChart({ points, unit }: { points: Point[]; unit: string }) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 52 };
  const values = points.map((p) => p.e1rm);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const yMin = Math.max(0, lo - span * 0.15);
  const yMax = hi + span * 0.15;
  const x = (i: number) =>
    points.length === 1 ? (pad.left + width - pad.right) / 2 : pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto text-foreground"
      role="img"
      aria-label={`Estimated 1RM per session, ${points.length} sessions`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
          <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={p.day + i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            {formatShortDay(p.day)}
          </text>
        ) : null
      )}
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={`pt-${p.day}-${i}`}>
          <circle cx={x(i)} cy={y(p.e1rm)} r={4} fill="currentColor" className="stroke-background" strokeWidth={2} />
          {/* Larger invisible hit target for the tooltip. */}
          <circle cx={x(i)} cy={y(p.e1rm)} r={12} fill="transparent">
            <title>
              {`${formatDay(p.day)}: ${formatWeight(p.e1rm, unit)} est. 1RM (${formatWeight(p.weight, unit)} x ${p.reps ?? '-'})`}
            </title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

export default async function LiftExercisePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { model, unit } = await loadLiftModel();
  const detail = exerciseDetail(model, decodeURIComponent(key), unit);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lift" className="text-sm text-muted-foreground hover:underline">
          Back to overview
        </Link>
        <h2 className="text-2xl font-semibold mt-1">{detail.name}</h2>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Sessions" value={String(detail.sessions)} />
        <StatCard title="Logged sets" value={String(detail.loggedSets)} subtitle="Warm-ups excluded" />
        <StatCard title="Heaviest set" value={formatWeight(detail.heaviest, unit)} />
        <StatCard title="Best est. 1RM" value={formatWeight(detail.bestSets[0]?.e1rm ?? null, unit)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estimated 1RM over time</CardTitle>
          <CardDescription>
            Best set per session, Epley: weight x (1 + reps / 30), 1 to 12 reps, in {unit}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.e1rmOverTime.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sets with weight and 1 to 12 reps.</p>
          ) : (
            <>
              <E1rmChart points={detail.e1rmOverTime as Point[]} unit={unit} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Best set</TableHead>
                    <TableHead className="text-right">Est. 1RM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...detail.e1rmOverTime].reverse().map((p, i) => (
                    <TableRow key={`${p.day}-${i}`}>
                      <TableCell className="whitespace-nowrap">{formatDay(p.day)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatWeight(p.weight, unit)} x {p.reps ?? '-'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatWeight(p.e1rm, unit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best sets</CardTitle>
          <CardDescription>Top sets by estimated 1RM.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Reps</TableHead>
                <TableHead className="text-right">Est. 1RM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.bestSets.map((s, i) => (
                <TableRow key={`${s.sessionId}-${i}`}>
                  <TableCell className="whitespace-nowrap">{formatDay(s.day)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWeight(s.weight, unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.reps ?? '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWeight(s.e1rm, unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
