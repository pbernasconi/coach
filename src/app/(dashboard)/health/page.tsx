import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import { CHART_DAYS, loadClinicianNotes, loadGarminStatus, loadHealth } from '@/lib/vitals/queries';
import ClinicianNotes from './ClinicianNotes';
import { load, safe } from '@/lib/safe';
import { loadGarminSections } from '@/lib/vitals/garmin-pages';
import SectionError from '@/components/SectionError';
import GarminSections from '@/components/vitals/GarminSections';
import GarminStatusLine from '@/components/vitals/GarminStatusLine';
import { addDays } from '@/lib/vitals/readiness.mjs';
import { todayIn } from '@/lib/plan/week.mjs';
import type { TooltipRow } from '@/components/charts/ChartTooltip';
import HealthTrendChart from './HealthTrendChart';
import LabsSection from './LabsSection';
import ReadinessTiles from './ReadinessTiles';

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

const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;

export default async function HealthPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="health" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const from = addDays(today, -(CHART_DAYS - 1));
  const [{ readiness, series, hrvMeasure, sleepStages, baselines, labs }, garmin, sections, notes] = await Promise.all([
    loadHealth(userId, today),
    // The Garmin line is optional: the page still renders when it fails.
    safe('garmin status', () => loadGarminStatus(userId), null),
    load('Sleep and recovery', () => loadGarminSections(userId, today)),
    load('Clinician notes', () => loadClinicianNotes(userId)),
  ]);
  const now = Date.now();
  const hasSamples = readiness.lastSampleDate !== null || Object.values(series).some((s) => s.length > 0);

  const sleepDetails: Record<string, TooltipRow[]> = Object.fromEntries(
    Object.entries(sleepStages).map(([d, s]) => [
      d,
      (['deep', 'rem', 'core', 'awake'] as const).flatMap((k) =>
        s[k] === null ? [] : [{ key: k, label: k === 'rem' ? 'REM' : k === 'awake' ? 'awake' : `${k} sleep`, value: hm(s[k]) }]
      ),
    ])
  );
  const band = (b: { mean: number; sd: number } | null, unit: string) =>
    b ? { low: b.mean - b.sd, high: b.mean + b.sd, label: `60-day baseline ${Math.round(b.mean)} ± ${Math.round(b.sd)} ${unit}` } : null;

  return (
    <div className="space-y-8" data-smoke="health">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="text-muted-foreground">
          Recovery signals from Garmin Connect (or Apple Health) and blood tests from Function Health.
          {readiness.lastSampleDate && ` Newest health data: ${readiness.lastSampleDate}.`}
        </p>
        <GarminStatusLine status={garmin} now={now} />
      </div>

      {hasSamples ? (
        <>
          <ReadinessTiles r={readiness} />
          {sections.ok ? <GarminSections s={sections.value} /> : <SectionError label="Sleep and recovery" />}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Last 90 days</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HealthTrendChart
                title={`HRV (${hrvMeasure})`}
                subtitle={hrvMeasure === 'RMSSD' ? 'Overnight average RMSSD from Garmin. Higher than your normal means recovered.' : 'Daily SDNN from Apple Health. Higher than your normal means recovered.'}
                points={series.hrv} from={from} to={today} unit="ms" band={band(baselines.hrv, 'ms')} linkDays />
              <HealthTrendChart title="Sleep" subtitle="Time asleep, by the night that ends on the day." points={series.sleep} from={from} to={today} unit="asleep" kind="bar" format="duration" details={sleepDetails} linkDays />
              <HealthTrendChart title="Weight" subtitle="Daily weight." points={series.weight} from={from} to={today} unit="kg" decimals={1} linkDays />
              <HealthTrendChart title="VO2max" subtitle="Estimated by the watch after outdoor runs and rides." points={series.vo2max} from={from} to={today} unit="mL/kg/min" decimals={1} />
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No health data yet.</p>
          <p className="mt-1">
            A daily job in GitHub Actions reads Garmin Connect and sends one value per day and metric to Coach: HRV, resting heart rate,
            sleep and sleep score, Body Battery, stress, training readiness, VO2max, weight and more. Data appears here after its first run.
            The Lift app can also send Apple Health data in the same way.
          </p>
        </div>
      )}

      <LabsSection categories={labs.categories} draws={labs.draws} />
      {notes.ok ? <ClinicianNotes groups={notes.value} /> : <SectionError label="Clinician notes" />}
    </div>
  );
}
