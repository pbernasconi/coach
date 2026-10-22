import type { ReactNode } from 'react';
import { Download, ImagePlus } from 'lucide-react';
import { IMAGE_VIEWS, IMAGE_VIEW_LABELS } from '@/lib/vitals/dexa-images.mjs';
import type { DexaFile } from '@/lib/vitals/dexa-store';
import UploadFiles from './UploadFiles';

/**
 * One scan's BodySpec images (composite, fat, lean, bone) at their own shape. With none, each view is a short slot
 * that uploads one.
 */
export default function ScanImages({ resultId, files }: { resultId: string; files: DexaFile[] }) {
  const byView = new Map(files.filter((f) => f.kind === 'image' && f.view).map((f) => [f.view!, f]));
  const upload = (v: (typeof IMAGE_VIEWS)[number], className: string, children: ReactNode) => (
    <UploadFiles resultId={resultId} view={v} accept="image/png,image/jpeg,image/webp" label={`Upload the ${IMAGE_VIEW_LABELS[v].toLowerCase()} image`} className={className}>
      {children}
    </UploadFiles>
  );
  if (!byView.size) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {IMAGE_VIEWS.map((v) => (
          <li key={v}>
            {upload(v, 'flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--viz-axis)] text-xs text-[var(--viz-muted)] hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]', <><ImagePlus className="h-5 w-5" aria-hidden />{IMAGE_VIEW_LABELS[v]}</>)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
      {IMAGE_VIEWS.filter((v) => byView.has(v)).map((v) => {
        const href = `/api/dexa/files/${byView.get(v)!.id}`;
        return (
          <figure key={v} className="space-y-1.5">
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- a private file behind the owner's session; next/image cannot fetch it */}
              <img src={href} alt={`${IMAGE_VIEW_LABELS[v]} image`} className="h-[26rem] w-auto rounded-xl bg-white ring-1 ring-[var(--viz-grid)]" />
            </a>
            <figcaption className="flex items-center justify-between text-sm text-[var(--viz-ink-2)]">
              {IMAGE_VIEW_LABELS[v]}
              <a href={`${href}?download=1`} aria-label={`Download the ${IMAGE_VIEW_LABELS[v].toLowerCase()} image`} className="rounded p-1 text-[var(--viz-muted)] hover:text-[var(--viz-ink)]">
                <Download className="h-3.5 w-3.5" aria-hidden />
              </a>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
