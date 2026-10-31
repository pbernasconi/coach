import PmcChart from '@/components/charts/PmcChart';
import type { Pmc } from '@/lib/performance/projection';
import { projectionCaption } from '@/lib/performance/display.mjs';
import RampRates from './RampRates';

/** The PMC with the plan's projection (its caption in the chart's (i)), and the ramp-rate tile under it (`ramp={false}` leaves it out). Data: loadPmc (src/lib/performance/projection.ts). */
export default function PmcSection({ pmc, ramp = true }: { pmc: Pmc; ramp?: boolean }) {
  const caption = projectionCaption(pmc);
  // One decimal is plenty for a chart, and keeps years of days small in the page.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const days = pmc.days.map((d) => ({ ...d, ctl: r1(d.ctl), atl: r1(d.atl), tsb: r1(d.tsb), tss: Math.round(d.tss) }));
  return (
    <div className="space-y-4">
      <PmcChart days={days} today={pmc.today} events={pmc.events} note={caption} />
      {ramp && <RampRates ramp={pmc.ramp} />}
    </div>
  );
}
