import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail, exerciseInfo } from '@/lib/lift-dashboard/stats.mjs';
import { exerciseMedia, type ExerciseMedia } from '@/lib/lift/catalog';
import ExerciseThumb from '@/components/lift/ExerciseThumb';
import { formatWeight } from '@/lib/lift-dashboard/format';
import { bestSetText } from '@/lib/lift-dashboard/app-api.mjs';
import ResponsiveDay from '@/components/ResponsiveDay';
import E1rmChart, { type Point } from './E1rmChart';

export const metadata: Metadata = { title: 'Exercise' };

export const dynamic = 'force-dynamic';

export default async function LiftExercisePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { model, unit } = await loadLiftModel();
  const exerciseKey = decodeURIComponent(key);
  const info = exerciseInfo(model, exerciseKey);
  if (!info) notFound();
  const media = exerciseMedia(info.catalogId);
  const detail = exerciseDetail(model, exerciseKey, unit);
  const header = <ExerciseHeader name={detail?.name ?? info.name} media={media} />;

  // Planned in a session but not logged yet: what it is and how to do it, and no numbers.
  if (!detail) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>No sets logged yet</CardTitle>
            {media && <CardDescription>How to do it, from the Lift exercise library.</CardDescription>}
          </CardHeader>
          {media && media.steps.length > 0 && (
            <CardContent>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                {media.steps.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

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
                        {bestSetText(p.weight, p.reps, unit)}
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

function ExerciseHeader({ name, media }: { name: string; media: ExerciseMedia | null }) {
  return (
    <div className="flex items-end gap-4">
      {media?.image && <ExerciseThumb image={media.image} gif={media.gif} name={name} size="md" />}
      <div>
        <Link href="/lift" className="text-sm text-muted-foreground hover:underline">
          Back to overview
        </Link>
        <h2 className="text-2xl font-semibold mt-1">{name}</h2>
      </div>
    </div>
  );
}
