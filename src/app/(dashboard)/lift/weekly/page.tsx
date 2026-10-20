import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { weeklyVolume } from '@/lib/lift-dashboard/stats.mjs';
import { formatDay, formatVolume } from '@/lib/lift-dashboard/format';

export const dynamic = 'force-dynamic';

export default async function LiftWeeklyPage() {
  const { model, unit } = await loadLiftModel();
  const weeks = weeklyVolume(model, unit);
  const max = Math.max(1, ...weeks.map((w) => w.volume));

  return (
    <Card data-smoke="lift-weekly">
      <CardHeader>
        <CardTitle>Weekly volume</CardTitle>
        <CardDescription>
          Weeks start on Monday. Volume = reps x logged weight over logged sets, warm-ups excluded, in {unit}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week of</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Sets</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="w-1/3 hidden sm:table-cell">
                  <span className="sr-only">Volume bar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.map((w) => (
                <TableRow key={w.week}>
                  <TableCell className="whitespace-nowrap">{formatDay(w.week)}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.sets}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVolume(w.volume, unit)}</TableCell>
                  <TableCell className="hidden sm:table-cell" aria-hidden="true">
                    <div
                      className="h-2 rounded-r bg-foreground/70"
                      style={{ width: `${(w.volume / max) * 100}%` }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
