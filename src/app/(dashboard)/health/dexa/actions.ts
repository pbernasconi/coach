'use server';

import { revalidatePath } from 'next/cache';
import { clearCache } from '@/lib/data-cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { deleteFile, linkFile, setFileView } from '@/lib/vitals/dexa-store';
import { isImageView } from '@/lib/vitals/dexa-images.mjs';

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

/** Sets which scan image view (composite, fat, lean, bone) an uploaded image is, or none. */
export async function setDexaFileView(form: FormData) {
  const userId = await owner();
  const view = form.get('view');
  await setFileView(userId, String(form.get('id') ?? ''), isImageView(view) ? view : null);
  clearCache('dexa');
  revalidatePath('/health/dexa', 'layout');
}
