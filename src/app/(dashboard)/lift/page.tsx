import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { exerciseList, sessionSummaries, weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { formatDay, formatVolume, formatWeight } from '@/lib/lift-dashboard/format';

export const dynamic = 'force-dynamic';

const RECENT_SESSIONS = 20;

export default async function LiftOverviewPage() {
  const { model, unit } = await loadLiftModel();
  const sessions = sessionSummaries(model, unit);
  const exercises = exerciseList(model, unit);
  const thisWeek = weeklyVolume(model, unit)[0];

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No sessions yet</CardTitle>
          <CardDescription>Sessions appear here after the Lift app syncs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Sessions" value={String(sessions.length)} />
        <StatCard title="Exercises" value={String(exercises.length)} />
        <StatCard
          title="Latest week volume"
          value={thisWeek ? formatVolume(thisWeek.volume, unit) : '-'}
          subtitle={thisWeek ? `Week of ${formatDay(thisWeek.week)}` : undefined}
        />
        <StatCard
          title="Latest week sets"
          value={thisWeek ? String(thisWeek.sets) : '-'}
          subtitle="Logged, warm-ups excluded"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>
            Volume = reps x logged weight over logged sets, warm-ups excluded, in {unit}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Sets logged</TableHead>
                <TableHead className="text-right">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, RECENT_SESSIONS).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap">{formatDay(s.day)}</TableCell>
                  <TableCell>{s.title || '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.setsLogged} / {s.setsTotal}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVolume(s.volume, unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exercises</CardTitle>
          <CardDescription>Estimated 1RM uses Epley, weight x (1 + reps / 30), for 1 to 12 reps.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead>Last done</TableHead>
                <TableHead className="text-right">Best est. 1RM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercises.map((e) => (
                <TableRow key={e.key}>
                  <TableCell>
                    <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="font-medium hover:underline">
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.sessions}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDay(e.lastDay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatWeight(e.bestE1rm, unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
