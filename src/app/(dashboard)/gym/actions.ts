'use server';

import { revalidatePath } from 'next/cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { createClient, googleCalendarLink, MX3Error } from '@/lib/mx3/client.mjs';
import { normalizeTime } from '@/lib/mx3/parse.mjs';

export type GymResult = { ok: boolean; message: string; calendarLink?: string; credits?: number | null };

async function owner() {
  if (!(await ownerForSignedInUser())) throw new Error('Not signed in');
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function bookAction(date: string, time: string, station: string): Promise<GymResult> {
  await owner();
  if (!DATE.test(date) || !normalizeTime(time) || !/^[\w -]{1,40}$/.test(station)) return { ok: false, message: 'Bad booking request.' };
  try {
    const r = await createClient().book({ date, time, station });
    revalidatePath('/gym');
    return {
      ok: r.ok,
      message: r.message,
      credits: r.credits?.after ?? null,
      calendarLink: r.ok ? googleCalendarLink({ station: r.slot.station, date, time: r.slot.time }) : undefined,
    };
  } catch (e) {
    return { ok: false, message: e instanceof MX3Error ? e.message : 'Could not reach MX3.' };
  }
}

export async function cancelAction(id: string): Promise<GymResult> {
  await owner();
  if (!/^\d{1,12}$/.test(id)) return { ok: false, message: 'Bad booking id.' };
  try {
    const r = await createClient().cancel(id);
    revalidatePath('/gym');
    return { ok: r.ok, message: r.message, credits: r.credits?.after ?? null };
  } catch (e) {
    return { ok: false, message: e instanceof MX3Error ? e.message : 'Could not reach MX3.' };
  }
}
