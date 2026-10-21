'use server';

import { revalidatePath } from 'next/cache';
import { clearCache } from '@/lib/data-cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { deleteFile, linkFile } from '@/lib/vitals/dexa-store';

async function owner() {
  const id = await ownerForSignedInUser();
  if (!id) throw new Error('Not signed in');
  return id;
}

/** Deletes an uploaded DEXA file. */
export async function deleteDexaFile(form: FormData) {
  const userId = await owner();
  await deleteFile(userId, String(form.get('id') ?? ''));
  clearCache('dexa');
  revalidatePath('/health/dexa', 'layout');
}

/** Moves an uploaded DEXA file to another scan, or to none. */
export async function linkDexaFile(form: FormData) {
  const userId = await owner();
  const resultId = String(form.get('resultId') ?? '');
  await linkFile(userId, String(form.get('id') ?? ''), resultId || null);
  clearCache('dexa');
  revalidatePath('/health/dexa', 'layout');
}
