import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail } from '@/lib/lift-dashboard/stats.mjs';
import { formatWeight } from '@/lib/lift-dashboard/format';
import ResponsiveDay from '@/components/ResponsiveDay';
import E1rmChart, { type Point } from './E1rmChart';

export const dynamic = 'force-dynamic';

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
                    <TableHead className="whitespace-nowrap text-right">Est. 1RM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...detail.e1rmOverTime].reverse().map((p, i) => (
                    <TableRow key={`${p.day}-${i}`}>
                      <TableCell className="whitespace-nowrap"><ResponsiveDay day={p.day} /></TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatWeight(p.weight, unit)} x {p.reps ?? '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatWeight(p.e1rm, unit)}</TableCell>
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
                <TableHead className="whitespace-nowrap text-right">Est. 1RM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.bestSets.map((s, i) => (
                <TableRow key={`${s.sessionId}-${i}`}>
                  <TableCell className="whitespace-nowrap"><ResponsiveDay day={s.day} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatWeight(s.weight, unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.reps ?? '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatWeight(s.e1rm, unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
