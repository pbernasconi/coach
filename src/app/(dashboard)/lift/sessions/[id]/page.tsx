import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import SectionError from '@/components/SectionError';
import { loadLiftModel } from '@/lib/lift-dashboard/queries';
import { sessionDetail } from '@/lib/lift-dashboard/stats.mjs';
import { formatDay, formatVolume, formatWeight } from '@/lib/lift-dashboard/format';
import { cookieTimeZone } from '@/lib/plan/timezone';
import { load } from '@/lib/safe';

export const dynamic = 'force-dynamic';

type Detail = NonNullable<ReturnType<typeof sessionDetail>>;

const STATUS: Record<string, string> = { done: 'Done', skipped: 'Skipped', planned: 'Not logged' };

type SetRow = Detail['exercises'][number]['sets'][number];

/** What Lift planned for a set: "230 lb × 8", "+25 lb × 8–10", or "-". */
function targetText(t: SetRow['target'], loadMode: string | null, unit: string) {
  const reps = t.reps != null ? String(t.reps) : t.repMin != null && t.repMax != null ? (t.repMin === t.repMax ? String(t.repMin) : `${t.repMin}–${t.repMax}`) : null;
  const w = loadMode === 'bodyweight' ? (t.weight ? `+${formatWeight(t.weight, unit)}` : 'BW') : t.weight != null ? formatWeight(t.weight, unit) : null;
  if (!reps && !w) return '-';
  return `${w ?? '-'} × ${reps ?? '-'}`;
}

function startTime(iso: string | null, tz: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
}

function duration(minutes: number | null) {
  if (minutes === null) return '-';
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

/**
 * One Lift session: its totals, then each exercise in order with its sets. /lift/sessions/<session id>, or
 * /lift/sessions/latest for the newest session (the deploy check renders that one).
 */
export default async function LiftSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).slice(0, 64);
  const loaded = await load('Lift session', async () => {
    const { model, unit } = await loadLiftModel();
    return sessionDetail(model, id, unit) as Detail | null;
  });
  if (!loaded.ok) {
    return (
      <div data-smoke="lift-session" className="space-y-4">
        <BackLink />
        <SectionError label="Lift session" />
      </div>
    );
  }
  const d = loaded.value;
  if (!d) {
    if (id !== 'latest') notFound();
    return (
      <div data-smoke="lift-session" className="space-y-2">
        <BackLink />
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No sessions yet. Sessions appear here after the Lift app syncs.
        </p>
      </div>
    );
  }

  const tz = await cookieTimeZone();
  const start = startTime(d.startedAt, tz);
  const unit = d.unit;

  return (
    <div data-smoke="lift-session" className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <BackLink />
          <div className="flex items-center gap-1">
            {d.olderId ? (
              <Link href={`/lift/sessions/${d.olderId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Older session">
                <ChevronLeft className="h-4 w-4" /> Older
              </Link>
            ) : null}
            {d.newerId ? (
              <Link href={`/lift/sessions/${d.newerId}`} className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-accent" aria-label="Newer session">
                Newer <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-[var(--viz-ink)]">{d.title || 'Lift session'}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDay(d.day)}
          {start ? ` at ${start}` : ''}
        </p>
        {d.note && <p className="whitespace-pre-wrap text-sm text-[var(--viz-ink-2)]">{d.note}</p>}
      </header>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Duration" value={duration(d.minutes)} />
        <StatCard title="Volume" value={formatVolume(d.volume, unit)} subtitle="Warm-ups excluded" />
        <StatCard title="Sets logged" value={`${d.setsLogged} / ${d.setsTotal}`} />
        <StatCard title="Exercises" value={String(d.exercises.length)} />
      </div>

      {d.exercises.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This session has no exercises.</p>
      ) : (
        d.exercises.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/lift/exercises/${encodeURIComponent(e.key)}`} className="hover:underline">
                  {e.name}
                </Link>
              </CardTitle>
              <CardDescription className="tabular-nums">
                {e.setsLogged} / {e.sets.length} sets logged · {formatVolume(e.volume, unit)}
                {e.note ? ` · ${e.note}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Set</TableHead>
                    <TableHead className="text-right text-muted-foreground">Target</TableHead>
                    <TableHead className="text-right">Weight × reps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {e.sets.map((s) => (
                    <TableRow key={s.id} className={s.status === 'done' ? '' : 'text-muted-foreground'}>
                      <TableCell className="tabular-nums" title={s.kind === 'warmUp' ? 'Warm-up' : undefined}>{s.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                        {targetText(s.target, e.loadMode, unit)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {s.status === 'done' ? `${formatWeight(s.weight, unit)} × ${s.reps ?? '-'}` : '-'}
                      </TableCell>
                      <TableCell>
                        {STATUS[s.status] ?? s.status}
                        {s.note && <div className="text-xs text-muted-foreground sm:hidden">{s.note}</div>}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{s.note ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
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
