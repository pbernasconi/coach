// @ts-check
// The fixed home sessions (physio, the daily stretch, the home minis) by name. The planner names one in an event's
// `routine` and Coach writes its numbered lines into the description, so Claude doesn't spend a minute copying the
// same text every week. The lines come from plan-structure.md, so the prompt stays the one source. Pure.

import { SOURCES } from './prompt-sources.generated.mjs';

/** routine → its bold heading in plan-structure.md, its title and workoutType. */
export const ROUTINES = {
  'physio-a': { heading: 'Physio A — Achilles & calf', title: '🩹 Physio A: Achilles & calf', workoutType: 'strength-home' },
  'physio-b': { heading: 'Physio B — Knee & hip', title: '🩹 Physio B: Knee & hip', workoutType: 'strength-home' },
  'back-hip-stretch': { heading: 'Back & hip stretch', title: '🧘 Back & hip stretch', workoutType: 'mobility' },
  'knee-calf-mini': { heading: 'Knee & calf mini', title: '🏋️ Knee & calf mini', workoutType: 'strength-home' },
  'arm-finisher': { heading: 'Arm finisher', title: '🏋️ Arm finisher', workoutType: 'strength-home' },
  'mobility-mini': { heading: 'Mobility mini', title: '🧘 Mobility mini', workoutType: 'mobility' },
  'running-knee-strength': { heading: 'Running Knee Strength', title: '🏋️ Running knee strength', workoutType: 'strength-home' },
  mobility: { heading: 'Mobility', title: '🧘 Mobility', workoutType: 'mobility' },
};

/**
 * The lines of a routine: everything after its `**Heading**` line up to the next blank line.
 * @param {string} heading
 * @param {string} [text]
 */
export function routineLines(heading, text = SOURCES['plan-structure.md']) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.startsWith(`**${heading}**`));
  if (at < 0) return null;
  /** @type {string[]} */
  const out = [];
  // The heading's "(15 min, …)" can wrap onto the next lines: skip to its closing parenthesis, keeping what follows it.
  let depth = 0;
  let i = at;
  for (; i < lines.length; i++) {
    const l = i === at ? lines[i].slice(heading.length + 4) : lines[i];
    let rest = null;
    for (let c = 0; c < l.length; c++) {
      if (l[c] === '(') depth++;
      if (l[c] === ')' && --depth === 0) {
        rest = l.slice(c + 1);
        break;
      }
    }
    if (depth === 0) {
      const tail = (rest ?? l).replace(/^[\s.:]+/, '');
      if (tail) out.push(tail);
      break;
    }
  }
  for (const l of lines.slice(i + 1)) {
    if (!l.trim()) break;
    out.push(l);
  }
  return out.length ? out.join('\n') : null;
}

/** @type {Record<string, string | null>} */
const TEXT = Object.fromEntries(Object.entries(ROUTINES).map(([k, r]) => [k, routineLines(r.heading)]));

/**
 * The plan with every `routine` event filled in: the routine's lines after the coach's note (if any), and its title
 * and workoutType when the event has none. Unknown names are problems for the planner to fix.
 * @param {any} plan
 * @returns {{ plan: any, problems: string[] }}
 */
export function expandRoutines(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.events)) return { plan, problems: [] };
  /** @type {string[]} */
  const problems = [];
  const events = plan.events.map((/** @type {any} */ e, /** @type {number} */ i) => {
    if (!e || typeof e !== 'object' || e.routine == null) return e;
    const key = String(e.routine);
    const r = /** @type {Record<string, typeof ROUTINES['mobility']>} */ (ROUTINES)[key];
    const lines = TEXT[key];
    if (!r || !lines) {
      problems.push(`Event ${i + 1}: routine "${key}" is not one of ${Object.keys(ROUTINES).join(', ')}.`);
      return e;
    }
    const note = typeof e.description === 'string' ? e.description.trim() : '';
    // A description that already holds the lines (an old draft revised) is kept as it is.
    const description = note.includes(lines.split('\n')[0]) ? note : [note, lines].filter(Boolean).join('\n');
    return {
      ...e,
      title: typeof e.title === 'string' && e.title.trim() ? e.title : r.title,
      workoutType: e.workoutType || r.workoutType,
      activityType: e.activityType || 'strength',
      description,
    };
  });
  return { plan: { ...plan, events }, problems };
}

/**
 * The plan's summary for the stored markdown, from its review (the planner no longer writes one).
 * @param {any} plan
 */
export function summaryOf(plan) {
  const r = plan?.review;
  if (!r || typeof r !== 'object') return null;
  const lines = [];
  if (r.headline) lines.push(String(r.headline));
  for (const s of Array.isArray(r.reasoning) ? r.reasoning : []) lines.push(`- ${s}`);
  for (const d of Array.isArray(r.decisions) ? r.decisions : []) lines.push(`- ${d?.title ?? ''}: ${d?.why ?? ''}${d?.tradeoff ? ` (${d.tradeoff})` : ''}`);
  for (const w of Array.isArray(r.watch) ? r.watch : []) lines.push(`- Watch: ${w}`);
  return lines.length ? lines.join('\n') : null;
}
