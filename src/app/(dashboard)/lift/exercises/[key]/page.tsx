import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { HelpTooltip } from '@kobo/web';
import SectionError from '@/components/SectionError';
import { load } from '@/lib/safe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseDetail } from '@/lib/lift-dashboard/stats.mjs';
import { formatWeight } from '@/lib/lift-dashboard/format';
import ResponsiveDay from '@/components/ResponsiveDay';
import E1rmChart, { type Point } from './E1rmChart';

export const metadata: Metadata = { title: 'Exercise' };

export const dynamic = 'force-dynamic';

export default async function LiftExercisePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const loaded = await load('Lift exercise', async () => {
    const { model, unit } = await loadLiftModel();
    return { unit, detail: exerciseDetail(model, decodeURIComponent(key).slice(0, 80), unit) };
  });
  if (!loaded.ok) {
    return (
      <div data-smoke="lift-exercise" className="space-y-4">
        <BackLink />
        <SectionError label="Lift exercise" />
      </div>
    );
  }
  const { unit, detail } = loaded.value;
  if (!detail) notFound();

  return (
    <div data-smoke="lift-exercise" className="space-y-6">
      <div>
        <BackLink />
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
          <CardTitle className="inline-flex items-center gap-1.5">
            Estimated 1RM
            <HelpTooltip label="About estimated 1RM" icon={<Info aria-hidden />}>
              Best set per session, Epley: weight × (1 + reps / 30), sets of 1 to 12 reps, in {unit}.
            </HelpTooltip>
          </CardTitle>
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
                  {[...(detail.e1rmOverTime as (Point & { sessionId: string })[])].reverse().map((p, i) => (
                    <TableRow key={`${p.day}-${i}`}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/lift/sessions/${p.sessionId}`} className="hover:underline"><ResponsiveDay day={p.day} /></Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {formatWeight(p.weight, unit)} × {p.reps ?? '–'}
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
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/lift" className="text-sm text-muted-foreground hover:underline">
      Back to overview
    </Link>
  );
}
