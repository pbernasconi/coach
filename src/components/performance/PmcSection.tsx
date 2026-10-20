import PmcChart from '@/components/charts/PmcChart';
import type { Pmc } from '@/lib/performance/projection';
import RampRates from './RampRates';

/** The PMC with the plan's projection, and the ramp-rate tile under it (`ramp={false}` leaves it out). Data: loadPmc (src/lib/performance/projection.ts). */
export default function PmcSection({ pmc, ramp = true }: { pmc: Pmc; ramp?: boolean }) {
  const projected = pmc.days.filter((d) => d.projected);
  const end = projected.at(-1);
  return (
    <div className="space-y-4">
      <PmcChart days={pmc.days} today={pmc.today} events={pmc.events} />
      {end && (
        <p className="-mt-2 px-1 text-xs text-[var(--viz-muted)]">
          Projection to {end.date}: {pmc.plannedTss ? `${pmc.plannedTss} planned TSS` : 'no workouts planned, so it shows rest'}, fitness {Math.round(end.ctl)}, form {end.tsb > 0 ? '+' : ''}{Math.round(end.tsb)}.
          {pmc.estimatedWorkouts > 0 && ` ${pmc.estimatedWorkouts} planned ${pmc.estimatedWorkouts === 1 ? 'workout has' : 'workouts have'} no TSS; estimated from duration and intensity.`}
        </p>
      )}
      {ramp && <RampRates ramp={pmc.ramp} />}
    </div>
  );
}
