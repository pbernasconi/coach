'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IMAGE_VIEWS, IMAGE_VIEW_LABELS, type ImageView } from '@/lib/vitals/dexa-images.mjs';

export type StripScan = { resultId: string; scanDate: string; fatPct: number | null };
export type StripImage = { id: string; resultId: string | null; view: ImageView | null };

const monthYY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");

/**
 * Every scan's image side by side, one view at a time (fat by default, where change shows best). A scan without that
 * image shows an empty slot; each image links to its scan.
 */
export default function ImageStrip({ scans, images }: { scans: StripScan[]; images: StripImage[] }) {
  const has = (v: ImageView) => images.some((i) => i.view === v);
  const [view, setView] = useState<ImageView>(has('fat') ? 'fat' : (IMAGE_VIEWS.find(has) ?? 'fat'));
  const byScan = new Map(images.filter((i) => i.view === view && i.resultId).map((i) => [i.resultId!, i.id]));
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Image" className="flex flex-wrap gap-1.5">
        {IMAGE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={v === view}
            onClick={() => setView(v)}
            className={`h-8 rounded-full px-3 text-sm transition-colors ${v === view ? 'bg-[var(--viz-ink)] text-[var(--viz-surface)]' : 'bg-[var(--viz-band)] text-[var(--viz-ink)] hover:bg-[var(--viz-grid)]'}`}
          >
            {IMAGE_VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {scans.map((s) => {
          const id = byScan.get(s.resultId);
          return (
            <li key={s.resultId}>
              <Link href={`/health/dexa/${s.scanDate}`} className="group block space-y-1.5">
                {id ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a private file behind the owner's session; next/image cannot fetch it
                  <img src={`/api/dexa/files/${id}`} alt={`${IMAGE_VIEW_LABELS[view]} image, ${s.scanDate}`} loading="lazy" className="aspect-[9/16] w-full rounded-xl bg-black object-contain transition-opacity group-hover:opacity-90" />
                ) : (
                  <span className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-[var(--viz-axis)] text-xs text-[var(--viz-muted)]">No image</span>
                )}
                <span className="block text-center text-xs tabular-nums text-[var(--viz-ink-2)]">
                  {monthYY(s.scanDate)}
                  {s.fatPct !== null && <span className="text-[var(--viz-muted)]"> · {s.fatPct.toFixed(1)}%</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
