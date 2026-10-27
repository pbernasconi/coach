// The plan's change log as text (plan_changes, written by a database trigger; drizzle/0024_plan_changes.sql): one
// line per change, "Tue Oct 27 09:12 · Coach chat · moved Heavy barbell from Mon Oct 26 to Tue Oct 27". Pure.

const SOURCE = {
  chat: 'Coach chat',
  app: 'iPhone',
  web: 'Plan page',
  planner: 'Planner',
  calendar: 'Google Calendar',
  lift: 'Lift (moved on the phone)',
  script: 'Script',
  unknown: 'Unknown',
};

/** "Coach chat" for 'chat'; an unknown source as it is. */
export function sourceLabel(source) {
  return SOURCE[source] ?? String(source ?? 'Unknown');
}

/** 'YYYY-MM-DD' of a stored date ("2026-10-26T00:00:00", "2026-10-26"), else null. */
function dayOf(v) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : null;
}

/** "Mon Oct 26" for '2026-10-26'. */
export function shortDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '');
}

const FIELD = {
  title: 'title', description: 'description', duration: 'duration', distance: 'distance', tss: 'TSS',
  intensity: 'intensity', start_time: 'start time', end_time: 'end time', workout_type: 'workout type',
  steps: 'steps', why: 'why', lift_template: 'Lift template', activity_type: 'sport', sort_order: 'order',
  skip_reason: 'skip reason', adapted_from: 'adapted', time_zone: 'time zone',
};

/**
 * What one change did, in words.
 * @param {{ op: string, title?: string | null, before?: Record<string, any> | null, after?: Record<string, any> | null }} c
 */
export function describeChange(c) {
  const title = c.title || 'a workout';
  if (c.op === 'insert') {
    const day = dayOf(c.after?.scheduled_date);
    return `added ${title}${day ? ` on ${shortDay(day)}` : ''}`;
  }
  if (c.op === 'delete') {
    const day = dayOf(c.before?.scheduled_date);
    return `removed ${title}${day ? ` from ${shortDay(day)}` : ''}`;
  }
  const before = c.before ?? {};
  const after = c.after ?? {};
  const parts = [];
  if ('scheduled_date' in after) {
    const from = dayOf(before.scheduled_date);
    const to = dayOf(after.scheduled_date);
    parts.push(`moved ${title}${from ? ` from ${shortDay(from)}` : ''}${to ? ` to ${shortDay(to)}` : ''}`);
  }
  if ('status' in after) {
    const s = after.status;
    const reason = after.skip_reason ? ` (${after.skip_reason})` : '';
    parts.push(s === 'skipped' ? `skipped ${title}${reason}` : s === 'done' ? `marked ${title} done` : `put ${title} back to planned`);
  }
  if ('lift_session_id' in after) {
    parts.push(after.lift_session_id ? `linked a Lift session to ${title}` : `unlinked the Lift session of ${title}`);
  }
  // A new week's plan for a moved workout is part of the move.
  const skip = new Set(['scheduled_date', 'status', 'skip_reason', 'lift_session_id', 'plan_id', 'id']);
  const others = Object.keys(after).filter((k) => !skip.has(k)).map((k) => FIELD[k] ?? k.replace(/_/g, ' '));
  if ('title' in after && before.title) parts.push(`renamed ${before.title} to ${after.title}`);
  const rest = others.filter((f) => f !== 'title');
  if (rest.length) parts.push(`changed ${rest.join(', ')} of ${title}`);
  return parts.length ? parts.join('; ') : `changed ${title}`;
}

/** "Tue Oct 27 09:12" in `timeZone`. */
export function changeTime(at, timeZone = 'America/Los_Angeles') {
  const d = at instanceof Date ? at : new Date(at);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).replace(',', '');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  return `${day} ${time}`;
}

/**
 * The change as one line: when, who, what.
 * @param {{ at: Date | string, source: string, op: string, title?: string | null, before?: any, after?: any }} c
 * @param {string} [timeZone]
 */
export function changeLine(c, timeZone) {
  return `${changeTime(c.at, timeZone)} · ${sourceLabel(c.source)} · ${describeChange(c)}`;
}
