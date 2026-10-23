'use client';

import { useState } from 'react';
import type { Board } from '@/lib/vitals/garmin-pages';
import CoverageStrip from './CoverageStrip';
import DayChart from './DayChart';
import { STAGE_STYLE } from './stages';
import { boardChart, boardFoot, hm, rhrInfo, weightAside } from '@/lib/vitals/health-view.mjs';

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
  const rhrNormal = b.stats.rhr.normal;
  const sleepTop = Math.max(8, ...s.sleep.map((v, i) => Math.ceil(((v ?? 0) + (s.awake[i] ?? 0)) / 240) * 4));
  const sleepTicks = Array.from({ length: sleepTop / 4 + 1 }, (_, i) => i * 240);
  const foot = (key: string) => boardFoot(b, key);
  const info = (key: string) => boardChart(key).info;
  const goal = (key: string) => boardChart(key).goal;
  const soft = (c: string) => `color-mix(in oklab, ${c} 72%, var(--viz-surface))`;

  return (
    <section className="space-y-3" data-smoke="health-board">
      <CoverageStrip days={b.days} coverage={b.coverage} counts={b.counts} hover={hover} onHover={setHover} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DayChart
          {...common}
          title={boardChart('sleep').title}
          foot={foot('sleep')}
          goal={goal('sleep')}
          info={<>Time asleep, filed under the morning you wake up. Stacked: {(['deep', 'light', 'rem', 'awake'] as const).map((k) => STAGE_STYLE[k].label).join(', ')}.</>}
          kind="stack"
          stack={(['deep', 'light', 'rem', 'awake'] as const).map((k) => ({ values: s[k], color: STAGE_STYLE[k].color, label: k }))}
          readout={(i) => (s.sleep[i] === null ? null : `${hm(s.sleep[i] as number)} h`)}
          tickFormat={(v) => `${Math.round(v / 60)}h`}
          ticks={sleepTicks}
        />
        <DayChart
          {...common}
          title={boardChart('hrv').title}
          foot={foot('hrv')}
          info={info('hrv')}
          kind="line"
          values={s.hrv}
          band={{ low: s.hrvLow, high: s.hrvHigh }}
          pointColor={(i) => STATUS_COLOR[s.hrvStatus[i] ?? 0] ?? null}
          readout={(i) => int(s.hrv[i], ' ms')}
        />
        <DayChart
          {...common}
          title={boardChart('rhr').title}
          foot={foot('rhr')}
          info={rhrInfo(rhrNormal)}
          kind="line"
          values={s.rhr}
          band={rhrNormal ? { low: rhrNormal.low, high: rhrNormal.high } : null}
          color="var(--viz-hr)"
          readout={(i) => int(s.rhr[i], ' bpm')}
        />
        <DayChart
          {...common}
          title={boardChart('sleepScore').title}
          foot={foot('sleepScore')}
          goal={goal('sleepScore')}
          info={info('sleepScore')}
          kind="bar"
          values={s.sleepScore}
          yFloor={0}
          yCeil={100}
          color={soft('var(--viz-ctl)')}
          readout={(i) => int(s.sleepScore[i])}
        />
        <DayChart
          {...common}
          title={boardChart('bbHigh').title}
          foot={foot('bbHigh')}
          goal={goal('bbHigh')}
          info={info('bbHigh')}
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
          title={boardChart('readiness').title}
          foot={foot('readiness')}
          goal={goal('readiness')}
          info={info('readiness')}
          kind="bar"
          values={s.readiness}
          yFloor={0}
          yCeil={100}
          color={soft('var(--viz-ctl)')}
          readout={(i) => int(s.readiness[i])}
        />
        <DayChart
          {...common}
          title={boardChart('stress').title}
          foot={foot('stress')}
          goal={goal('stress')}
          info={info('stress')}
          kind="bar"
          values={s.stress}
          yFloor={0}
          color={soft('var(--color-amber-500)')}
          readout={(i) => int(s.stress[i])}
        />
        <DayChart
          {...common}
          title={boardChart('respiration').title}
          foot={foot('respiration')}
          info={info('respiration')}
          kind="line"
          values={s.respiration}
          color="var(--viz-cadence)"
          readout={(i) => dec(s.respiration[i], ' brpm')}
        />
        <DayChart
          {...common}
          title={boardChart('intensity').title}
          foot={foot('intensity')}
          goal={goal('intensity')}
          info={info('intensity')}
          kind="bar"
          values={s.intensity}
          yFloor={0}
          color={soft('var(--viz-run)')}
          readout={(i) => int(s.intensity[i], ' min')}
          aside={`week ${Math.round(b.intensityWeek)}/150`}
        />
        <DayChart
          {...common}
          title={boardChart('steps').title}
          foot={foot('steps')}
          goal={goal('steps')}
          kind="bar"
          values={s.steps}
          yFloor={0}
          color="var(--viz-axis)"
          tickFormat={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
          readout={(i) => (s.steps[i] === null ? null : Math.round(s.steps[i] as number).toLocaleString('en-US'))}
        />
        <DayChart
          {...common}
          title={boardChart('weight').title}
          info={info('weight')}
          kind="line"
          watchless
          values={s.weight}
          trend={s.weightTrend}
          color="var(--viz-muted)"
          readout={(i) => dec(s.weight[i], ' kg')}
          aside={weightAside(b.stats.weight.trend)}
        />
        <DayChart
          {...common}
          title={boardChart('vo2max').title}
          info={info('vo2max')}
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
