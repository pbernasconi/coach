/**
 * The Coach chat's reminders on the server (reminder-tools.mjs has the pure parts): Apply and Undo of
 * { op: "reminder" } in users.settings.reminders, and the list the iPhone schedules (GET /api/app/coach/reminders).
 */

import { sql } from '@/db';
import { addReminder, dropReminder, upcoming, type Reminder, type ReminderChange } from './reminder-tools.mjs';

async function editReminders(userId: string, edit: (list: unknown) => Reminder[]) {
  const [u] = (await sql`SELECT settings -> 'reminders' AS list FROM users WHERE id = ${userId}`) as { list: unknown }[];
  if (!u) throw new Error('user not found');
  await sql`
    UPDATE users SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{reminders}', ${JSON.stringify(edit(u.list))}::jsonb), updated_at = NOW()
    WHERE id = ${userId}`;
}

export async function applyReminder(userId: string, c: ReminderChange, nowMs = Date.now()): Promise<{ op: 'unremind'; id: string }> {
  await editReminders(userId, (list) => addReminder(list, { id: c.id, at: c.at, text: c.text, createdAt: new Date(nowMs).toISOString() }, nowMs));
  return { op: 'unremind', id: c.id };
}

export async function undoReminder(userId: string, id: string): Promise<void> {
  await editReminders(userId, (list) => dropReminder(list, id));
}

/** The reminders still to come, soonest first. */
export async function loadReminders(userId: string, nowMs = Date.now()) {
  const [u] = (await sql`SELECT settings -> 'reminders' AS list FROM users WHERE id = ${userId}`) as { list: unknown }[];
  return upcoming(u?.list ?? [], nowMs);
}
