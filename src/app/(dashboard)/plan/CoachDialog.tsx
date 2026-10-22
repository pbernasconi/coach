'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The frame of the coach's dialogs on the Plan page: a title, a scrolling body and a footer. Full screen on a phone. */
export default function CoachDialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border',
            wide ? 'sm:w-[min(76rem,calc(100vw-3rem))]' : 'sm:w-[min(52rem,calc(100vw-3rem))]'
          )}
        >
          <header className="flex shrink-0 items-start gap-3 border-b px-4 py-3.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-6">{title}</Dialog.Title>
              {subtitle && <div className="mt-0.5 text-sm text-[var(--viz-ink-2)]">{subtitle}</div>}
            </div>
            <Dialog.Close aria-label="Close" className="-mr-1.5 rounded-md p-1.5 hover:bg-accent"><X aria-hidden className="h-5 w-5" /></Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:px-6 sm:py-5">{children}</div>
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">{footer}</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A section heading inside a coach dialog. */
export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--viz-muted)]">
      {children}
      {hint && <span className="font-normal normal-case tracking-normal">{hint}</span>}
    </h3>
  );
}

/** One-of chips; a second click on the picked chip clears it. */
export function Choice<T extends string | number>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: React.ReactNode;
  options: readonly { id: T; label: React.ReactNode; badge?: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-[var(--viz-ink)]">
        {label}
        {hint && <span className="text-xs font-normal text-[var(--viz-muted)]">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(value === o.id ? null : o.id)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors',
              value === o.id ? 'border-transparent bg-[#fc4c02] text-white' : 'hover:bg-accent'
            )}
          >
            {o.label}
            {o.badge && (
              <span className={cn('rounded px-1 text-[10px] font-medium uppercase', value === o.id ? 'bg-white/20' : 'bg-muted text-[var(--viz-muted)]')}>{o.badge}</span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
