import { FileText, Trash2 } from 'lucide-react';
import type { DexaFile } from '@/lib/vitals/dexa-store';

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Uploaded report PDFs and scan images: images inline, PDFs as tiles that open the file. `onDelete` is a server
 * action taking the file id; `scanLabel` names the scan a file belongs to when the gallery shows several scans.
 */
export default function FileGallery({
  files,
  onDelete,
  scanLabel,
}: {
  files: DexaFile[];
  onDelete: (form: FormData) => Promise<void>;
  scanLabel?: (resultId: string | null) => string | null;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((f) => {
        const href = `/api/dexa/files/${f.id}`;
        const scan = scanLabel?.(f.resultId);
        return (
          <li key={f.id} className="group relative overflow-hidden rounded-lg border bg-[var(--viz-surface)]">
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {f.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element -- a private file behind the owner's session; next/image cannot fetch it
                <img src={href} alt={f.name} loading="lazy" className="aspect-[3/4] w-full bg-black object-contain" />
              ) : (
                <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-[var(--viz-band)] text-[var(--viz-ink-2)]">
                  <FileText className="h-8 w-8" aria-hidden />
                  <span className="text-xs">PDF{f.hasText ? ' · text read' : ''}</span>
                </span>
              )}
              <span className="block space-y-0.5 border-t px-2.5 py-2">
                <span className="block truncate text-sm text-[var(--viz-ink)]">{f.name}</span>
                <span className="block text-xs text-[var(--viz-muted)]">
                  {[scan, size(f.sizeBytes)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </a>
            <form action={onDelete} className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <input type="hidden" name="id" value={f.id} />
              <button type="submit" aria-label={`Delete ${f.name}`} className="rounded-md border bg-[var(--viz-surface)] p-1.5 text-[var(--viz-ink-2)] hover:text-[var(--viz-down)]">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
