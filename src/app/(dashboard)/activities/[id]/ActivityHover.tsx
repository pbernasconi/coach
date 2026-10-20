'use client';

import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

/** A highlighted stretch of the activity: series buckets `from`–`to` (inclusive). `key` names the row it came from. */
export type HighlightRange = { key: string; label: string; from: number; to: number };

/**
 * State shared by the stream charts, the map and the tables: the chart point under the cursor (`index`), and the
 * highlighted range. A row previews its range while the pointer or the focus is on it; a click pins it.
 */
type Hover = {
  index: number | null;
  setIndex: (i: number | null) => void;
  range: HighlightRange | null; // the preview, else the pinned range
  pinned: string | null;
  preview: (r: HighlightRange | null) => void;
  togglePin: (r: HighlightRange) => void;
};

const HoverContext = createContext<Hover>({ index: null, setIndex: () => {}, range: null, pinned: null, preview: () => {}, togglePin: () => {} });

export function ActivityHoverProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const [previewed, setPreviewed] = useState<HighlightRange | null>(null);
  const [pin, setPin] = useState<HighlightRange | null>(null);
  const togglePin = useCallback((r: HighlightRange) => setPin((p) => (p?.key === r.key ? null : r)), []);
  const value = useMemo(
    () => ({ index, setIndex, range: previewed ?? pin, pinned: pin?.key ?? null, preview: setPreviewed, togglePin }),
    [index, previewed, pin, togglePin],
  );
  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export const useActivityHover = () => useContext(HoverContext);

/**
 * A table row that highlights its range on the charts and the map: on pointer over and keyboard focus, and pinned
 * by a click or Enter / Space (again to unpin). A row without a range is a plain row.
 */
export function RangeRow({ range, className = '', children }: { range: HighlightRange | null; className?: string; children: ReactNode }) {
  const { range: active, pinned, preview, togglePin } = useActivityHover();
  if (!range) return <tr className={className}>{children}</tr>;
  const on = active?.key === range.key;
  const isPinned = pinned === range.key;
  const leave = () => preview(null);
  return (
    <tr
      tabIndex={0}
      data-pinned={isPinned || undefined}
      title={isPinned ? 'Pinned on the charts and the map. Click to unpin.' : 'Click to pin on the charts and the map.'}
      onPointerEnter={() => preview(range)}
      onPointerLeave={leave}
      onFocus={() => preview(range)}
      onBlur={leave}
      onClick={() => togglePin(range)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        togglePin(range);
      }}
      className={`${className} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--viz-ctl)] ${on ? 'bg-[var(--viz-band)]' : 'hover:bg-[var(--viz-band)]'} ${isPinned ? 'shadow-[inset_3px_0_0_var(--viz-ink-2)]' : ''}`}
    >
      {children}
    </tr>
  );
}
