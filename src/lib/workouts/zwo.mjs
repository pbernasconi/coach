// A structured ride as a Zwift workout file (.zwo). Power is a fraction of the FTP set in Zwift. Zwift has no heart
// rate or pace targets on the bike, so those steps become the power range of the same Coach zone; an open step is
// free ride. A two-step repeat is IntervalsT; any other repeat is written out. docs/research/structured-workouts.md §5.

import { ZONE_RANGES, zoneOf } from './steps.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (pct) => (Math.round(pct * 10) / 1000).toFixed(3);

/** [low, high] in % of FTP for a step: its power target, else the power of its Coach zone; null when open. */
function powerRange(s) {
  if (s.target.type === 'power') return [s.target.low, s.target.high];
  if (s.target.type === 'open') return null;
  return ZONE_RANGES[zoneOf(s.target, 'run')].power;
}

function seconds(s) {
  if (s.duration.type === 'time') return s.duration.s;
  return 600; // Zwift needs a duration; a lap or distance step becomes 10 min of free ride
}

const text = (s) => (s.notes ? `<textevent timeoffset="0" message="${esc(s.notes)}"/>` : '');
const cadence = (s) => (s.cadence ? ` CadenceLow="${s.cadence[0]}" CadenceHigh="${s.cadence[1]}"` : '');

function block(s) {
  const d = seconds(s);
  const p = powerRange(s);
  if (!p || s.duration.type !== 'time') return `<FreeRide Duration="${d}" FlatRoad="1">${text(s)}</FreeRide>`;
  if (s.ramp || ((s.kind === 'warmup' || s.kind === 'cooldown') && p[0] !== p[1])) {
    const tag = s.kind === 'cooldown' ? 'Cooldown' : s.kind === 'warmup' ? 'Warmup' : 'Ramp';
    // A warm-up climbs low → high; a cool-down comes down high → low.
    const [a, b] = s.kind === 'cooldown' ? [p[1], p[0]] : p;
    return `<${tag} Duration="${d}" PowerLow="${f(a)}" PowerHigh="${f(b)}"${cadence(s)}>${text(s)}</${tag}>`;
  }
  // ERG holds one value: the middle of the range.
  return `<SteadyState Duration="${d}" Power="${f((p[0] + p[1]) / 2)}"${cadence(s)}>${text(s)}</SteadyState>`;
}

function blocks(list) {
  const out = [];
  for (const s of list) {
    if (s.kind !== 'repeat') {
      out.push(block(s));
      continue;
    }
    const [on, off] = s.steps;
    const simple = s.steps.length === 2 && on.kind !== 'repeat' && off.kind !== 'repeat' && on.duration.type === 'time' && off.duration.type === 'time' && powerRange(on) && powerRange(off);
    if (simple) {
      const pOn = powerRange(on);
      const pOff = powerRange(off);
      out.push(
        `<IntervalsT Repeat="${s.count}" OnDuration="${on.duration.s}" OffDuration="${off.duration.s}" OnPower="${f((pOn[0] + pOn[1]) / 2)}" OffPower="${f((pOff[0] + pOff[1]) / 2)}"${cadence(on)}>${text(on)}</IntervalsT>`
      );
    } else {
      for (let i = 0; i < s.count; i++) out.push(...blocks(s.steps));
    }
  }
  return out;
}

/**
 * @param {import('./steps.mjs').Workout} w a ride
 * @param {{ description?: string }} [opts]
 */
export function toZwo(w, opts = {}) {
  if (w.sport !== 'ride') throw new Error('.zwo is for rides');
  const body = blocks(w.steps).map((b) => `    ${b}`).join('\n');
  return `<workout_file>
  <author>Coach</author>
  <name>${esc(w.name)}</name>
  <description>${esc(opts.description ?? w.notes ?? '')}</description>
  <sportType>bike</sportType>
  <tags><tag name="COACH"/></tags>
  <workout>
${body}
  </workout>
</workout_file>
`;
}
