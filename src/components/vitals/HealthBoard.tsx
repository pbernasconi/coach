'use client';

import { useState } from 'react';
import type { Board } from '@/lib/vitals/garmin-pages';
import CoverageStrip from './CoverageStrip';
import DayChart from './DayChart';
import { STAGE_STYLE } from './stages';

const hm = (m: number) => `${Math.floor(Math.round(m) / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const int = (v: number | null, unit = '') => (v === null ? null : `${Math.round(v)}${unit}`);
const dec = (v: number | null, unit = '') => (v === null ? null : `${v.toFixed(1)}${unit}`);
const STATUS_COLOR: Record<number, string> = { 1: 'var(--viz-down)', 2: 'var(--viz-down)', 3: 'var(--color-amber-500)' }; // Poor, Low, Unbalanced

/**
 * The /health board: the watch-coverage strip and a grid of small charts on one shared day axis. Hovering any of
 * them reads that day on all of them; a click opens the day.
 */
export default function HealthBoard({ b }: { b: Board }) {
  const [hover, setHover] = useState<number | null>(null);
  const s = b.series;
  const common = { days: b.days, coverage: b.coverage, hover, onHover: setHover };
  const avg = (v: (number | null)[]) => {
    const xs = v.filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null;
  };
  const sleepAvg = avg(s.sleep);
  const rhrNormal = b.stats.rhr.normal;
  const steps = avg(s.steps);
  const sleepTop = Math.max(8, ...s.sleep.map((v, i) => Math.ceil(((v ?? 0) + (s.awake[i] ?? 0)) / 240) * 4));
  const sleepTicks = Array.from({ length: sleepTop / 4 + 1 }, (_, i) => i * 240);
  const soft = (c: string) => `color-mix(in oklab, ${c} 72%, var(--viz-surface))`;

  return (
    <section className="space-y-3" data-smoke="health-board">
      <CoverageStrip days={b.days} coverage={b.coverage} counts={b.counts} hover={hover} onHover={setHover} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DayChart
          {...common}
          title="Sleep"
          info={<>Time asleep, filed under the morning you wake up. Stacked: {(['deep', 'light', 'rem', 'awake'] as const).map((k) => STAGE_STYLE[k].label).join(', ')}.</>}
          kind="stack"
          stack={(['deep', 'light', 'rem', 'awake'] as const).map((k) => ({ values: s[k], color: STAGE_STYLE[k].color, label: k }))}
          readout={(i) => (s.sleep[i] === null ? null : `${hm(s.sleep[i] as number)} h`)}
          aside={sleepAvg === null ? undefined : `avg ${hm(sleepAvg)}`}
          tickFormat={(v) => `${Math.round(v / 60)}h`}
          ticks={sleepTicks}
        />
        <DayChart
          {...common}
          title="HRV"
          info="Overnight average (RMSSD, ms). Shaded: Garmin's balanced range for you. Amber and red dots: unbalanced or low nights."
          kind="line"
          values={s.hrv}
          band={{ low: s.hrvLow, high: s.hrvHigh }}
          pointColor={(i) => STATUS_COLOR[s.hrvStatus[i] ?? 0] ?? null}
          readout={(i) => int(s.hrv[i], ' ms')}
        />
        <DayChart
          {...common}
          title="Resting HR"
          info={rhrNormal ? `Beats per minute. Shaded: your normal, ${Math.round(rhrNormal.low)}–${Math.round(rhrNormal.high)} bpm (60 days).` : 'Beats per minute.'}
          kind="line"
          values={s.rhr}
          band={rhrNormal ? { low: rhrNormal.low, high: rhrNormal.high } : null}
          color="var(--viz-hr)"
          readout={(i) => int(s.rhr[i], ' bpm')}
        />
        <DayChart
          {...common}
          title="Sleep score"
          info="Garmin's 0–100 score for the night. 80+ good, 60–79 fair, under 60 poor."
          kind="bar"
          values={s.sleepScore}
          yFloor={0}
          yCeil={100}
          color={soft('var(--viz-ctl)')}
          readout={(i) => int(s.sleepScore[i])}
        />
        <DayChart
          {...common}
          title="Body Battery"
          info="Each bar runs from the day's lowest to its highest Body Battery (0–100)."
          kind="range"
          values={s.bbHigh}
          low={s.bbLow}
          yFloor={0}
          yCeil={100}
          color={soft('var(--viz-good)')}
          readout={(i) => (s.bbHigh[i] === null ? null : `${s.bbLow[i] === null ? '' : `${Math.round(s.bbLow[i] as number)}–`}${Math.round(s.bbHigh[i] as number)}`)}
        />
        <DayChart
          {...common}
          title="Training readiness"
          info="Garmin's morning score (0–100): 75+ high, 50–74 moderate, 25–49 low."
          kind="bar"
          values={s.readiness}
          yFloor={0}
          yCeil={100}
          color={soft('var(--viz-ctl)')}
          readout={(i) => int(s.readiness[i])}
        />
        <DayChart
          {...common}
          title="Stress"
          info="Garmin's all-day average stress (0–100). Under 25 is rest."
          kind="bar"
          values={s.stress}
          yFloor={0}
          color={soft('var(--color-amber-500)')}
          readout={(i) => int(s.stress[i])}
        />
        <DayChart
          {...common}
          title="Respiration"
          info="Average breaths per minute while asleep."
          kind="line"
          values={s.respiration}
          color="var(--viz-cadence)"
          readout={(i) => dec(s.respiration[i], ' brpm')}
        />
        <DayChart
          {...common}
          title="Intensity minutes"
          info="Moderate minutes plus vigorous minutes counted twice, as Garmin does. The weekly goal is 150."
          kind="bar"
          values={s.intensity}
          yFloor={0}
          color={soft('var(--viz-run)')}
          readout={(i) => int(s.intensity[i], ' min')}
          aside={`week ${Math.round(b.intensityWeek)}/150`}
        />
        <DayChart
          {...common}
          title="Steps"
          kind="bar"
          values={s.steps}
          yFloor={0}
          color="var(--viz-axis)"
          tickFormat={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          readout={(i) => (s.steps[i] === null ? null : Math.round(s.steps[i] as number).toLocaleString('en-US'))}
          aside={steps === null ? undefined : `avg ${Math.round(steps / 100) / 10}k`}
        />
        <DayChart
          {...common}
          title="Weight"
          info="From the scale. Readings are joined across days without one."
          kind="line"
          connect
          watchless
          values={s.weight}
          color="var(--viz-ink-2)"
          readout={(i) => dec(s.weight[i], ' kg')}
        />
        <DayChart
          {...common}
          title="VO2max"
          info="Estimated by the watch after outdoor runs (mL/kg/min)."
          kind="line"
          connect
          watchless
          values={s.vo2max}
          color="var(--viz-ink-2)"
          readout={(i) => dec(s.vo2max[i])}
        />
      </div>
    </section>
  );
}
