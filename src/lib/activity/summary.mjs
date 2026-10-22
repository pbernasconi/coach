// The activity page's summary: a few headline numbers, then the rest in groups by meaning (effort, heart, running
// form or power, conditions), each value with a word that says where it sits. Shared by the web page (Sections.tsx)
// and the app API (app-api.mjs `overview.hero`/`groups`). No framework or database imports (node --test).

import { duration, int, km, kmh, pace } from './format.mjs';
import { tssMethodLabel } from '../strava-sync/tss.mjs';

/**
 * @typedef {'good' | 'ok' | 'warn' | 'bad'} Tone
 * @typedef {{ min: number, max: number, cuts: number[], value: number, lowerIsBetter?: boolean }} Scale
 *   A track from min to max, split at `cuts` into bands, with the value as a tick.
 * @typedef {{ key: string, label: string, valueText: string, unit?: string, sub?: string, word?: string, tone?: Tone, scale?: Scale }} Row
 * @typedef {{ id: string, title: string, tag?: string, rows: Row[], footer?: string[], note?: string }} Group
 */

const present = (/** @type {any[]} */ xs) => xs.filter(Boolean);
const r1 = (/** @type {number} */ v) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * Where a value falls in bands: the index of the first cut it is below (0 … cuts.length).
 * @param {number} value
 * @param {number[]} cuts ascending
 */
export function bandOf(value, cuts) {
  const i = cuts.findIndex((c) => value < c);
  return i === -1 ? cuts.length : i;
}

/**
 * Garmin's running dynamics bands (Garmin Connect's colours: the share of runners), worst to best for a value where
 * higher is better, and the words for the five bands.
 */
const PERCENTILE_WORDS = ['Bottom 5%', 'Below average', 'Average', 'Top 30%', 'Top 5%'];
const PERCENTILE_TONES = /** @type {Tone[]} */ (['bad', 'warn', 'ok', 'good', 'good']);

/**
 * A running dynamics row with Garmin's bands. `cuts` ascend; `lowerIsBetter` flips the words.
 * @param {Omit<Row, 'word' | 'tone' | 'scale'>} row
 * @param {number} value
 * @param {number[]} cuts four ascending cuts
 * @param {{ lowerIsBetter?: boolean, min: number, max: number }} o
 * @returns {Row}
 */
function percentileRow(row, value, cuts, { lowerIsBetter = false, min, max }) {
  const band = bandOf(value, cuts);
  const rank = lowerIsBetter ? 4 - band : band;
  return { ...row, word: PERCENTILE_WORDS[rank], tone: PERCENTILE_TONES[rank], scale: { min, max, cuts, value, lowerIsBetter } };
}

/** Garmin's Training Effect words for 0–5. */
const TE_WORDS = ['No benefit', 'Minor', 'Maintaining', 'Improving', 'Highly improving', 'Overreaching'];
const TE_CUTS = [1, 2, 3, 4, 5];

/** @returns {Row} */
function teRow(/** @type {string} */ key, /** @type {string} */ label, /** @type {number} */ te) {
  const band = bandOf(te, TE_CUTS);
  return { key, label, valueText: r1(te), word: TE_WORDS[band], tone: band === 5 ? 'warn' : 'ok', scale: { min: 0, max: 5, cuts: TE_CUTS, value: te } };
}

/** Intensity factor from TSS and moving time: TSS = hours × IF² × 100. */
export function intensityOf(/** @type {number | null} */ tss, /** @type {number} */ movingSeconds) {
  if (tss == null || !(movingSeconds > 0) || !(tss > 0)) return null;
  return Math.sqrt(tss / ((movingSeconds / 3600) * 100));
}

const IF_CUTS = [0.75, 0.85, 0.95, 1.05];
const IF_WORDS = ['Easy', 'Steady', 'Tempo', 'Threshold', 'Above threshold'];

/** 'Easy' … 'Above threshold' for an intensity factor. */
export function intensityWord(/** @type {number} */ f) {
  return IF_WORDS[bandOf(f, IF_CUTS)];
}

/** The note behind Coach TSS: its method, and the caveat on run power against the cycling FTP. */
export function tssNote(/** @type {any} */ v) {
  const e = v.effort;
  if (e.tss == null) return null;
  const method = e.tssMethod ? `Coach TSS ${tssMethodLabel(e.tssMethod)}.` : null;
  const runPower = (e.tssMethod === 'power' || e.tssMethod === 'power_stream') && v.layout === 'run' && e.ftp;
  return present([method, runPower ? `Running power against the cycling FTP (${e.ftp} W) reads high for a run.` : null]).join(' ') || null;
}

/**
 * The headline numbers, at most six, in the sport's order. Each can carry a `sub` line (elapsed time, GAP, max HR,
 * intensity) so the companion number does not need its own tile.
 * @returns {Row[]}
 */
export function heroStats(/** @type {any} */ v) {
  const st = v.stats;
  const foot = v.layout === 'run';
  const ride = v.layout === 'ride';
  const stopped = st.elapsed && st.moving && st.elapsed - st.moving >= 60;
  const f = intensityOf(v.effort.tss, st.moving);
  const power = ride ? st.np ?? st.avgWatts : null;
  return present([
    st.distance > 0 && { key: 'distance', label: 'Distance', valueText: km(st.distance), unit: 'km' },
    { key: 'time', label: 'Moving time', valueText: duration(st.moving), sub: stopped ? `${duration(st.elapsed)} elapsed` : undefined },
    foot && st.avgSpeed && { key: 'pace', label: 'Pace', valueText: pace(st.avgSpeed), unit: '/km', sub: st.avgGapSpeed ? `GAP ${pace(st.avgGapSpeed)}` : undefined },
    !foot && st.avgSpeed && st.distance > 0 && { key: 'speed', label: 'Speed', valueText: kmh(st.avgSpeed), unit: 'km/h', sub: st.maxSpeed ? `max ${kmh(st.maxSpeed)}` : undefined },
    st.elevGain > 0 && { key: 'elevation', label: 'Elevation', valueText: int(st.elevGain), unit: 'm' },
    power && { key: 'power', label: st.np ? 'Normalized power' : 'Avg power', valueText: int(power), unit: 'W', sub: st.np && st.avgWatts ? `avg ${int(st.avgWatts)} W` : undefined },
    st.avgHr && { key: 'hr', label: 'Heart rate', valueText: int(st.avgHr), unit: 'bpm', sub: st.maxHr ? `max ${int(st.maxHr)}` : undefined },
    v.effort.tss != null && { key: 'tss', label: 'Coach TSS', valueText: String(Math.round(v.effort.tss)), sub: f != null ? `IF ${f.toFixed(2)} · ${intensityWord(f).toLowerCase()}` : undefined },
  ]).slice(0, 6);
}

/**
 * The groups under the headline. Empty groups are left out.
 * @returns {Group[]}
 */
export function statGroups(/** @type {any} */ v) {
  const st = v.stats;
  const w = v.watch ?? null;
  const foot = v.layout === 'run';
  const ride = v.layout === 'ride';
  const e = v.effort;

  /** @type {Group} */
  const effort = {
    id: 'effort',
    title: 'Effort',
    tag: w?.teLabel ?? undefined,
    rows: present([
      w?.aerobicTe != null && teRow('aerobicTe', 'Aerobic effect', w.aerobicTe),
      w?.anaerobicTe != null && teRow('anaerobicTe', 'Anaerobic effect', w.anaerobicTe),
      w?.staminaStart != null && w?.staminaEnd != null && {
        key: 'stamina', label: 'Stamina', valueText: `${Math.round(w.staminaStart)} → ${Math.round(w.staminaEnd)}`, unit: '%',
        word: `${Math.max(0, Math.round(w.staminaStart - w.staminaEnd))}% used`,
        tone: w.staminaEnd < 20 ? 'warn' : 'ok',
        scale: { min: 0, max: 100, cuts: [], value: w.staminaEnd },
      },
      w?.bodyBatteryDelta != null && {
        key: 'bodyBattery', label: 'Body Battery', valueText: `${w.bodyBatteryDelta > 0 ? '+' : w.bodyBatteryDelta < 0 ? '−' : ''}${Math.abs(Math.round(w.bodyBatteryDelta))}`,
      },
      st.perceivedExertion != null && { key: 'rpe', label: 'Perceived exertion', valueText: `${st.perceivedExertion}/10` },
    ]),
    // The other load scores, one line: they count the same session in other units.
    footer: present([
      w?.load != null && `Garmin load ${Math.round(w.load)}`,
      e.sufferScore != null && `Relative Effort ${e.sufferScore}`,
      e.trimp != null && `TRIMP ${e.trimp}`,
      st.calories != null && `${int(st.calories)} kcal`,
    ]),
  };

  /** @type {Group} */
  const heart = {
    id: 'heart',
    title: 'Heart & lungs',
    rows: present([
      w?.performanceCondition != null && (() => {
        const pc = Math.round(w.performanceCondition);
        return {
          key: 'performanceCondition', label: 'Performance condition', valueText: `${pc > 0 ? '+' : pc < 0 ? '−' : ''}${Math.abs(pc)}`,
          word: pc < -2 ? 'Below baseline' : pc > 2 ? 'Above baseline' : 'At baseline',
          tone: pc < -5 ? 'bad' : pc < -2 ? 'warn' : pc > 2 ? 'good' : 'ok',
          scale: { min: -10, max: 10, cuts: [-2.5, 2.5], value: Math.max(-10, Math.min(10, pc)) },
        };
      })(),
      w?.vo2max != null && { key: 'vo2max', label: 'VO2max', valueText: String(Math.round(w.vo2max)) },
      w?.respirationBrpm != null && { key: 'respiration', label: 'Breathing', valueText: String(Math.round(w.respirationBrpm)), unit: 'brpm' },
      !v.weather && st.avgTemp != null && { key: 'temp', label: 'Device temp', valueText: String(Math.round(st.avgTemp)), unit: '°C' },
    ]),
  };

  const cadence = st.avgCadence ?? null;
  /** @type {Group} */
  const form = foot
    ? {
        id: 'form',
        title: 'Running form',
        rows: present([
          cadence && percentileRow({ key: 'cadence', label: 'Cadence', valueText: int(cadence), unit: 'spm' }, cadence, [153, 164, 174, 184], { min: 140, max: 195 }),
          w?.gctMs != null && percentileRow({ key: 'gct', label: 'Ground contact', valueText: int(w.gctMs), unit: 'ms' }, w.gctMs, [208, 241, 273, 306], { lowerIsBetter: true, min: 180, max: 330 }),
          w?.verticalOscCm != null && percentileRow({ key: 'vo', label: 'Vertical oscillation', valueText: r1(w.verticalOscCm), unit: 'cm' }, w.verticalOscCm, [6.7, 8.4, 10.1, 11.9], { lowerIsBetter: true, min: 5, max: 13.5 }),
          w?.verticalRatioPct != null && percentileRow({ key: 'vr', label: 'Vertical ratio', valueText: r1(w.verticalRatioPct), unit: '%' }, w.verticalRatioPct, [6.1, 7.5, 8.7, 10.2], { lowerIsBetter: true, min: 5, max: 11.5 }),
          w?.strideM != null && { key: 'stride', label: 'Stride length', valueText: w.strideM.toFixed(2), unit: 'm' },
          (st.avgWatts || w?.powerW != null) && { key: 'power', label: st.avgWatts && !st.deviceWatts ? 'Est. power' : 'Power', valueText: int(st.avgWatts || w.powerW), unit: 'W' },
        ]),
      }
    : {
        id: 'power',
        title: ride ? 'Power & cadence' : 'Cadence',
        rows: present([
          ride && st.avgWatts && { key: 'avgPower', label: st.deviceWatts ? 'Avg power' : 'Est. avg power', valueText: int(st.avgWatts), unit: 'W' },
          ride && st.maxWatts && { key: 'maxPower', label: 'Max power', valueText: int(st.maxWatts), unit: 'W' },
          ride && st.kj && { key: 'work', label: 'Work', valueText: int(st.kj), unit: 'kJ' },
          ride && st.np && e.ftp && { key: 'if', label: 'Power vs FTP', valueText: `${Math.round((st.np / e.ftp) * 100)}`, unit: '%' },
          cadence && { key: 'cadence', label: 'Cadence', valueText: int(cadence), unit: 'rpm' },
        ]),
      };

  return [effort, heart, form].filter((g) => g.rows.length || g.footer?.length);
}

/** Time in each heart-rate zone as shares of the total (whole percents), or null without zone times. */
export function zoneShares(/** @type {Array<{ zone: number, name: string, seconds: number }>} */ zones) {
  const total = zones.reduce((n, z) => n + z.seconds, 0);
  if (!total) return null;
  return zones.map((z) => ({ zone: z.zone, name: z.name, seconds: z.seconds, share: z.seconds / total }));
}
