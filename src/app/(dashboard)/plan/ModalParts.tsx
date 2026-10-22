'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, X } from 'lucide-react';
import ComplianceMark from '@/components/plan/ComplianceMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { withTimeout } from '@/lib/plan/scroll.mjs';

/** Strava's orange, for the active tab and the main button. */
const ACCENT = '#fc4c02';

export const longDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const clock = (local: string) => {
  const m = /T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

// ---------------------------------------------------------------------------------------------------------------
// Shared parts

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ok'; value: T } | { status: 'error' }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    // A reload keeps the shown data until the new data comes.
    setState((st) => (st.status === 'ok' ? st : { status: 'loading' }));
    (withTimeout(fn(), 20_000, 'Loading the item') as Promise<T>).then(
      (value) => live && setState({ status: 'ok', value }),
      (error) => {
        console.error('Modal load failed:', error);
        if (live) setState({ status: 'error' });
      }
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Header({ icon, title, sub, right, onClose }: { icon: ReactNode; title: string; sub: ReactNode; right?: ReactNode; onClose: () => void }) {
  return (
    <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <Dialog.Title className="truncate text-lg font-bold tracking-tight text-[var(--viz-ink)] sm:text-xl">{title}</Dialog.Title>
        <p className="truncate text-xs text-[var(--viz-muted)] sm:text-sm">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <Dialog.Close
          aria-label="Close"
          className="rounded-md p-1.5 text-[var(--viz-muted)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
        >
          <X aria-hidden className="h-5 w-5" />
        </Dialog.Close>
      </div>
    </header>
  );
}

export function OpenButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" className="hidden text-white hover:opacity-90 sm:inline-flex" style={{ background: ACCENT }}>
      <Link href={href}>
        {label} <ArrowUpRight aria-hidden className="ml-1 h-4 w-4" />
      </Link>
    </Button>
  );
}

/** Strava's row of big numbers: value over a small label, with thin dividers. */
/** The plan status as a chip for the header: icon, label, and the share of the plan done. */
export function StatusChip({ level, ratio, basis }: { level: string; ratio: number | null; basis: string | null }) {
  return (
    <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:inline-flex" title={ratio != null ? `${Math.round(ratio * 100)}% of the planned ${basis === 'tss' ? 'TSS' : 'time'}` : undefined}>
      <ComplianceMark level={level} showLabel />
      {ratio != null && <span className="tabular-nums text-[var(--viz-muted)]">{Math.round(ratio * 100)}%</span>}
    </span>
  );
}

export type HeroStat = { label: string; value: string; unit?: string };

export function Hero({ stats }: { stats: (HeroStat | false | null | undefined | 0 | '')[] }) {
  const shown = stats.filter(Boolean) as HeroStat[];
  return (
    <dl className="flex flex-wrap gap-y-3 border-b px-4 py-4 sm:px-6">
      {shown.map((s, i) => (
        <div key={s.label} className={cn('min-w-[6.5rem] pr-5', i > 0 && 'sm:border-l sm:pl-5')}>
          <dd className="text-xl font-semibold tabular-nums tracking-tight text-[var(--viz-ink)] sm:text-2xl">
            {s.value}
            {s.unit && <span className="ml-0.5 text-sm font-normal text-[var(--viz-ink-2)]">{s.unit}</span>}
          </dd>
          <dt className="text-xs text-[var(--viz-muted)]">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** The section bar: a click scrolls to the section; the section in view is marked as you scroll. */
export function SectionNav<T extends string>({ items, active, onPick }: { items: { id: T; label: string }[]; active: T; onPick: (t: T) => void }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Sections" className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 sm:px-4">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={active === t.id ? 'true' : undefined}
          onClick={() => onPick(t.id)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            active === t.id ? 'text-[var(--viz-ink)]' : 'border-transparent text-[var(--viz-muted)] hover:text-[var(--viz-ink)]'
          )}
          style={active === t.id ? { borderBottomColor: ACCENT } : undefined}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** One section of the scrolling activity view, with its heading. */
export function Section({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return (
    <section data-section={id} className="space-y-4 border-b px-4 py-6 last:border-b-0 sm:px-6">
      {title && <h2 className="text-base font-semibold tracking-tight text-[var(--viz-ink)]">{title}</h2>}
      {children}
    </section>
  );
}

export function Panel({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 space-y-2', className)}>
      <h3 className="text-sm font-semibold text-[var(--viz-ink)]">
        {title}
        {note && <span className="ml-1.5 font-normal text-[var(--viz-muted)]">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

export const th = 'px-3 py-1.5 text-right font-medium whitespace-nowrap';
export const td = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap';

/** Rows of label / planned / completed, TrainingPeaks style. A row with neither value is left out. */
export function PlanTable({ rows, showPlanned }: { rows: [string, string | null, string | null][]; showPlanned: boolean }) {
  const shown = rows.filter(([, p, c]) => p || c);
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-[var(--viz-muted)]">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium"><span className="sr-only">Metric</span></th>
            {showPlanned && <th className={th}>Planned</th>}
            <th className={th}>Completed</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(([label, p, c]) => (
            <tr key={label} className="border-t">
              <td className="px-3 py-1.5 text-[var(--viz-ink-2)]">{label}</td>
              {showPlanned && <td className={cn(td, 'text-[var(--viz-muted)]')}>{p ?? '–'}</td>}
              <td className={cn(td, 'font-medium text-[var(--viz-ink)]')}>{c ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Loading() {
  return (
    <div aria-busy className="flex-1 space-y-4 p-6">
      <span className="sr-only">Loading</span>
      <div className="h-14 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}

export function Failed({ text }: { text: string }) {
  return <p className="m-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</p>;
}

export function Description({ title, text }: { title: string; text: string }) {
  return (
    <section className="min-w-0 rounded-xl border p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--viz-ink)]">{title}</h3>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--viz-ink)]">{text}</div>
    </section>
  );
}
