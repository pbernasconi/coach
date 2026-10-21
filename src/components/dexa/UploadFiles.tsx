'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

const MAX = 4 * 1024 * 1024;

/**
 * Uploads BodySpec report PDFs and scan images to POST /api/dexa/files, one request per file (Vercel takes 4.5 MB
 * a request). With `resultId` the files belong to that scan; without, the server matches a date in the file name.
 */
export default function UploadFiles({ resultId, label = 'Upload report' }: { resultId?: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        toast.error(`${file.name} is over 4 MB.`);
        continue;
      }
      const body = new FormData();
      body.set('file', file);
      if (resultId) body.set('resultId', resultId);
      try {
        const res = await fetch('/api/dexa/files', { method: 'POST', body });
        const json = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
        if (!res.ok) toast.error(`${file.name}: ${json.error ?? 'upload failed'}`);
        else if (json.duplicate) toast.message(`${file.name} is already stored.`);
        else ok++;
      } catch {
        toast.error(`${file.name}: upload failed`);
      }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} ${ok === 1 ? 'file' : 'files'} uploaded.`);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        aria-label={label}
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm text-[var(--viz-ink-2)] hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}
