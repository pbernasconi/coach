/**
 * POST /api/dexa/files: uploads a DEXA report (PDF) or scan image for the signed-in owner. Form fields: `file`,
 * optional `resultId` (the scan; else guessed from a date in the file name), `view` (composite, fat, lean or bone; else
 * guessed from the file name) and `note`. Answers `{ id, duplicate }`
 * or `{ error }`. At most 4 MB (Vercel's request limit is 4.5 MB).
 */

import { revalidatePath } from 'next/cache';
import { ownerForSignedInUser } from '@/lib/owner';
import { clearCache } from '@/lib/data-cache';
import { UploadError, loadScans, saveFile, scanForName } from '@/lib/vitals/dexa-store';
import { isImageView } from '@/lib/vitals/dexa-images.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await ownerForSignedInUser();
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'The upload could not be read (over 4 MB?).' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file.' }, { status: 400 });
  const chosen = String(form.get('resultId') ?? '').trim();
  try {
    const resultId = chosen || scanForName(file.name, await loadScans(userId));
    const saved = await saveFile(userId, {
      name: file.name,
      contentType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
      resultId: resultId || null,
      note: String(form.get('note') ?? '').trim() || null,
      view: isImageView(form.get('view')) ? (form.get('view') as 'composite' | 'fat' | 'lean' | 'bone') : null,
    });
    clearCache('dexa');
    revalidatePath('/health/dexa', 'layout');
    return Response.json(saved);
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    console.error('DEXA upload failed:', (e as Error).message);
    return Response.json({ error: 'The upload failed.' }, { status: 500 });
  }
}
