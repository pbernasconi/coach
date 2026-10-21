import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import Link from 'next/link';
import { loadClinicianNotes, loadGarminStatus, loadHealth } from '@/lib/vitals/queries';
import ClinicianNotes from './ClinicianNotes';
import { load, safe } from '@/lib/safe';
import { loadBoard } from '@/lib/vitals/garmin-pages';
import SectionError from '@/components/SectionError';
import GarminStatusLine from '@/components/vitals/GarminStatusLine';
import HealthBoard from '@/components/vitals/HealthBoard';
import VitalsSummary from '@/components/vitals/VitalsSummary';
import { todayIn } from '@/lib/plan/week.mjs';
import LabsSection from './LabsSection';
import DexaSection from './DexaSection';
import { loadDexa } from '@/lib/vitals/dexa-queries';

export const metadata: Metadata = { title: 'Health' };

export const dynamic = 'force-dynamic';

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

const RANGES = [30, 90] as const;

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const days = (await searchParams).days === '90' ? 90 : 30;
  // The Garmin line is optional: the page still renders when it fails.
  const garminP = safe('garmin status', () => loadGarminStatus(userId), null);
  const [{ readiness, labs }, garmin, board, notes, dexa] = await Promise.all([
    loadHealth(userId, today),
    garminP,
    garminP.then((g) => load('Health board', () => loadBoard(userId, today, days, g?.syncedThrough ?? null))),
    load('Clinician notes', () => loadClinicianNotes(userId)),
    load('Body composition', () => loadDexa(userId)),
  ]);
  const now = Date.now();
  const hasSamples = readiness.lastSampleDate !== null || (board.ok && board.value.counts.worn + board.value.counts.partial > 0);

  return (
    <div className="space-y-6" data-smoke="health">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
          <GarminStatusLine status={garmin} now={now} />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href={`/health/day/${today}`} className="text-muted-foreground hover:text-foreground">Today</Link>
          <Link href="/health/training" className="text-muted-foreground hover:text-foreground">Training</Link>
          <Link href="/health/labs" className="text-muted-foreground hover:text-foreground">Labs</Link>
          <nav aria-label="Chart range" className="inline-flex rounded-md border p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={r === 30 ? '/health' : `/health?days=${r}`}
                aria-current={r === days ? 'page' : undefined}
                scroll={false}
                className={`rounded px-2 py-0.5 text-xs tabular-nums ${r === days ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r}d
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {hasSamples ? (
        board.ok ? (
          <>
            <VitalsSummary r={readiness} b={board.value} />
            <HealthBoard b={board.value} />
          </>
        ) : (
          <SectionError label="Health board" />
        )
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No health data yet.</p>
          <p className="mt-1">The Garmin job in GitHub Actions sends one value per day and metric. Data appears here after its first run.</p>
        </div>
      )}

      {dexa.ok ? <DexaSection dexa={dexa.value} /> : <SectionError label="Body composition" />}
      <LabsSection categories={labs.categories} draws={labs.draws} />
      {notes.ok ? <ClinicianNotes groups={notes.value} /> : <SectionError label="Clinician notes" />}
    </div>
  );
}
