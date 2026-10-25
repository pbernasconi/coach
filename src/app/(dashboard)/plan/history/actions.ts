'use server';

import { revalidatePath } from 'next/cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { saveVerdict, type Verdict } from '@/lib/plan/history';

/** Paolo's good/bad verdict on a past plan, with one line why (the Past plans page). */
export async function saveVerdictAction(item: string, weekStart: string, verdict: Verdict | null, note: string) {
  const userId = await ownerForSignedInUser();
  if (!userId) throw new Error('Not signed in');
  if (!/^(week|proposal):[\w-]{1,64}$/.test(String(item)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart))) throw new Error('Bad item');
  const v = verdict === 'good' || verdict === 'bad' ? verdict : null;
  await saveVerdict(userId, item, weekStart, v, String(note ?? '').trim().slice(0, 300) || null);
  revalidatePath('/plan/history');
}
