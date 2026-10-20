'use server';

import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db';
import { ownerForSignedInUser } from '@/lib/owner';
import { parseEvent } from '@/lib/performance/events.mjs';

async function owner() {
  const id = await ownerForSignedInUser();
  if (!id) throw new Error('Not signed in');
  return id;
}

export type EventInput = { name: string; date: string; priority: string; sport: string; notes: string; target: string };
export type ActionResult = { ok: true } | { ok: false, error: string };

/** Adds an event, or updates it when `id` is given. */
export async function saveEventAction(input: EventInput, id?: string): Promise<ActionResult> {
  const userId = await owner();
  const parsed = parseEvent(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const e = parsed.value;
  if (id) {
    const rows = await sql`
      UPDATE events SET name = ${e.name}, date = ${e.date}, priority = ${e.priority}, sport = ${e.sport},
             notes = ${e.notes}, target = ${e.target}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    if (rows.length === 0) return { ok: false, error: 'Event not found' };
  } else {
    await sql`
      INSERT INTO events (id, user_id, name, date, priority, sport, notes, target)
      VALUES (${createId()}, ${userId}, ${e.name}, ${e.date}, ${e.priority}, ${e.sport}, ${e.notes}, ${e.target})`;
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const userId = await owner();
  await sql`DELETE FROM events WHERE id = ${id} AND user_id = ${userId}`;
  revalidatePath('/', 'layout');
  return { ok: true };
}
