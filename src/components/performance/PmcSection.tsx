import PmcChart from '@/components/charts/PmcChart';
import type { Pmc } from '@/lib/performance/projection';
import { projectionCaption } from '@/lib/performance/display.mjs';
import RampRates from './RampRates';

/** The PMC with the plan's projection (its caption in the chart's (i)), and the ramp-rate tile under it (`ramp={false}` leaves it out). Data: loadPmc (src/lib/performance/projection.ts). */
export default function PmcSection({ pmc, ramp = true }: { pmc: Pmc; ramp?: boolean }) {
  const caption = projectionCaption(pmc);
  return (
    <div className="space-y-4">
      <PmcChart days={pmc.days} today={pmc.today} events={pmc.events} note={caption} />
      {ramp && <RampRates ramp={pmc.ramp} />}
    </div>
  );
}
