import { Download, ImagePlus } from 'lucide-react';
import { IMAGE_VIEWS, IMAGE_VIEW_LABELS } from '@/lib/vitals/dexa-images.mjs';
import type { DexaFile } from '@/lib/vitals/dexa-store';
import UploadFiles from './UploadFiles';

/**
 * One scan's four BodySpec images (composite, fat, lean, bone). A view without an image is a slot that uploads one.
 */
export default function ScanImages({ resultId, files }: { resultId: string; files: DexaFile[] }) {
  const byView = new Map(files.filter((f) => f.kind === 'image' && f.view).map((f) => [f.view!, f]));
  // With no images yet the slots are short buttons; once one is in, every slot takes the image's shape.
  const slot = byView.size ? 'aspect-[9/16]' : 'h-24';
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {IMAGE_VIEWS.map((v) => {
        const f = byView.get(v);
        const href = f ? `/api/dexa/files/${f.id}` : null;
        return (
          <li key={v} className="space-y-1.5">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private file behind the owner's session; next/image cannot fetch it */}
                <img src={href} alt={`${IMAGE_VIEW_LABELS[v]} image`} className="aspect-[9/16] w-full rounded-xl bg-black object-contain" />
              </a>
            ) : (
              <UploadFiles
                resultId={resultId}
                view={v}
                accept="image/png,image/jpeg,image/webp"
                label={`Upload the ${IMAGE_VIEW_LABELS[v].toLowerCase()} image`}
                className={`flex ${slot} w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--viz-axis)] text-xs text-[var(--viz-muted)] hover:border-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]`}
              >
                <ImagePlus className="h-5 w-5" aria-hidden />
                Add image
              </UploadFiles>
            )}
            <p className="flex items-center justify-between text-sm text-[var(--viz-ink-2)]">
              {IMAGE_VIEW_LABELS[v]}
              {href && (
                <a href={`${href}?download=1`} aria-label={`Download the ${IMAGE_VIEW_LABELS[v].toLowerCase()} image`} className="rounded p-1 text-[var(--viz-muted)] hover:text-[var(--viz-ink)]">
                  <Download className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
