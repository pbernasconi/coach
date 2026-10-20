'use client';

import { useState } from 'react';
import ContentBlocks from './ContentBlocks';

/** "Why it matters", the sections for the current status, and "Sources", as tabs (arrow keys move between them). */
export default function BiomarkerTabs({ tabs }: { tabs: { key: string; title: string; body: string }[] }) {
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;
  const tab = tabs[Math.min(active, tabs.length - 1)];
  return (
    <section className="rounded-lg border bg-[var(--viz-surface)]">
      <div role="tablist" aria-label="About this biomarker" className="flex gap-1 overflow-x-auto border-b px-2 print:hidden">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`panel-${t.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              setActive(n);
              document.getElementById(`tab-${tabs[n].key}`)?.focus();
            }}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
              i === active ? 'border-[var(--viz-ink)] font-semibold text-[var(--viz-ink)]' : 'border-transparent text-[var(--viz-ink-2)] hover:text-[var(--viz-ink)]'
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div id={`panel-${tab.key}`} role="tabpanel" aria-labelledby={`tab-${tab.key}`} className="max-w-3xl px-4 py-5 sm:px-6">
        <ContentBlocks text={tab.body} />
      </div>
    </section>
  );
}
