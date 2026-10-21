'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Copies a scan's Markdown report, for pasting into a chat with an AI. */
export default function CopyReport({ text, label = 'Copy for AI' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm text-[var(--viz-ink-2)] hover:bg-accent hover:text-foreground"
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  );
}
