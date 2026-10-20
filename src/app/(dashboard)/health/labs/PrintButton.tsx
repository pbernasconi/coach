'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-full border bg-[var(--viz-surface)] px-4 text-sm text-[var(--viz-ink)] hover:bg-[var(--viz-band)] print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden /> Print
    </button>
  );
}
