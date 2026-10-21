// Paolo's zone anchors, from plans/PLAN-STRUCTURE.md (FTP 265 W, LTHR 168). Change them there and here.
// No imports, so node --test can run it (zones.test.mjs).

export const ZONES = {
  Z1: { hr: '<122 bpm', power: '<146 W' },
  Z2: { hr: '122–153 bpm', power: '148–199 W' },
  Z2top: { hr: '145–153 bpm', power: '186–199 W' },
  Z3: { hr: '153–168 bpm', power: '201–239 W' },
  Z4: { hr: '168–182 bpm', power: '241–278 W' },
  Z4top: { hr: '175–182 bpm', power: '254–276 W' },
  Z5: { hr: 'max effort, HR lags', power: '284–318 W' },
};

/**
 * The zone targets that apply to a workout, from its type, intensity and title.
 * Power is shown for rides only; runs go by heart rate (PLAN-STRUCTURE: HR for all but Z5).
 * @param {{ title?: string, workoutType?: string | null, intensity?: string | null, sport?: string }} w
 * @returns {{ zone: string, label: string, target: string }[]}
 */
export function zonesFor(w) {
  const t = `${w.workoutType ?? ''} ${w.intensity ?? ''} ${w.title ?? ''}`.toLowerCase();
  const ride = w.sport === 'ride' || /ride|bike|cycl|zwift/.test(t);
  const chip = (zone, label) => {
    const z = ZONES[zone];
    return { zone: zone.replace('top', ''), label, target: ride ? `${z.power} · ${z.hr}` : z.hr };
  };
  if (w.sport === 'strength' || w.sport === 'rest' || /strength|lift|rest/.test(t)) return [];
  if (/test-10k|10k test/.test(t)) return [chip('Z4', '10k at goal pace')];
  if (/vo2/.test(t)) return [chip('Z5', 'Intervals'), chip('Z2top', 'Finish: 10–20 min')];
  if (/threshold/.test(t)) return [chip('Z4top', 'Intervals'), chip('Z2top', 'Finish: 10–20 min')];
  if (/tempo|sweet.?spot|z3/.test(t)) return [chip('Z3', 'Main set')];
  if (/long/.test(t)) return ride ? [chip('Z2', 'Mostly'), chip('Z1', 'Easy parts')] : [chip('Z1', 'Mostly'), chip('Z2', 'Solid parts')];
  if (/recovery|easy|aerobic|z1|z2|endurance/.test(t)) return ride ? [chip('Z2', 'Steady')] : [chip('Z1', 'Easy'), chip('Z2', 'Top end')];
  return [];
}
