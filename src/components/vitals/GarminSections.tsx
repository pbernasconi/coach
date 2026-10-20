import Link from 'next/link';
import HealthTrendChart from '@/app/(dashboard)/health/HealthTrendChart';
import type { GarminSections as Sections } from '@/lib/vitals/garmin-pages';
import { addDays } from '@/lib/vitals/readiness.mjs';
import HrvStatusChart from './HrvStatusChart';
import IntensityWeeksChart from './IntensityWeeksChart';
import SleepStagesChart from './SleepStagesChart';

/**
 * The Garmin sections of /health: sleep stages for 30 nights, HRV against Garmin's baseline band, resting heart
 * rate, and intensity minutes per week. Each chart has its own empty state.
 */
export default function GarminSections({ s }: { s: Sections }) {
  const from = addDays(s.today, -89);
  return (
    <section className="space-y-3" data-smoke="garmin-sections">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Sleep and recovery</h2>
        <div className="flex gap-4 text-sm">
          <Link href={`/health/day/${s.today}`} className="underline underline-offset-4">Today in detail →</Link>
          <Link href="/health/training" className="underline underline-offset-4">Training →</Link>
        </div>
      </div>
      <SleepStagesChart nights={s.nights} />
      <div className="grid gap-4 md:grid-cols-2">
        <HrvStatusChart nights={s.hrv} from={from} to={s.today} />
        <HealthTrendChart
          title="Resting heart rate"
          subtitle="Daily resting HR from Garmin. Select a day to open it."
          points={s.restingHr}
          from={from}
          to={s.today}
          unit="bpm"
          linkDays
        />
      </div>
      <IntensityWeeksChart weeks={s.intensity} />
    </section>
  );
}
