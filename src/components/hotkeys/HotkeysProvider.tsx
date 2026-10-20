'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { findShortcut, ignoreKey, NAV_KEYS } from '@/lib/hotkeys.mjs';

/** One shortcut: the key (KeyboardEvent.key, letters lower case), what it does in words, and the action. */
export type Shortcut = { key: string; label: string; run: () => void };

type Registry = { add: (id: number, get: () => Shortcut[]) => void; remove: (id: number) => void };

const HotkeysContext = createContext<Registry | null>(null);
let nextId = 1;

/**
 * Adds a page's shortcuts while the page is on screen. They win over the global keys (1–6, t, ?), so the Plan page's
 * `t` scrolls to today instead of opening /plan. Pass a new list when the actions change; the latest is used.
 */
export function useHotkeys(list: Shortcut[]) {
  const registry = useContext(HotkeysContext);
  const latest = useRef(list);
  latest.current = list;
  useEffect(() => {
    if (!registry) return;
    const id = nextId++;
    registry.add(id, () => latest.current);
    return () => registry.remove(id);
  }, [registry]);
}

/** A key as it shows in the help: "?" and digits as they are, letters upper case, arrows as arrows. */
function keyLabel(key: string) {
  const arrows: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  return arrows[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * Keyboard shortcuts for the dashboard. Global: 1–6 open the nav sections, t opens today's plan, ? shows every key
 * of the current page. A page adds its own with useHotkeys. Keys never fire while typing, with Cmd/Ctrl/Alt, or
 * while another dialog is open (src/lib/hotkeys.mjs).
 */
export default function HotkeysProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pages = useRef(new Map<number, () => Shortcut[]>());
  const [help, setHelp] = useState(false);
  const pageLists = useCallback(() => [...pages.current.values()].map((get) => get()), []);
  const registry = useMemo<Registry>(
    () => ({
      add: (id, get) => void pages.current.set(id, get),
      remove: (id) => void pages.current.delete(id),
    }),
    []
  );

  const globals = useMemo<Shortcut[]>(
    () => [
      ...NAV_KEYS.map((n) => ({ key: n.key, label: `Go to ${n.label}`, run: () => router.push(n.href) })),
      { key: 't', label: "Today's plan", run: () => router.push('/plan') },
      { key: '?', label: 'Show these shortcuts', run: () => setHelp(true) },
    ],
    [router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dialogOpen = Boolean(document.querySelector('[role="dialog"]:not([data-hotkeys-help])'));
      if (help || ignoreKey(e, e.target as HTMLElement | null, dialogOpen)) return;
      const hit = findShortcut<Shortcut>(e.key, pageLists(), globals);
      if (!hit) return;
      e.preventDefault();
      hit.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globals, help, pageLists]);

  // The page keys hide the global key they replace.
  const pageList = help ? pageLists().flat() : [];
  const shownGlobals = globals.filter((g) => !pageList.some((p) => p.key === g.key));

  return (
    <HotkeysContext.Provider value={registry}>
      {children}
      <Dialog.Root open={help} onOpenChange={setHelp}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            data-hotkeys-help=""
            className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-base font-semibold">Keyboard shortcuts</Dialog.Title>
              <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">The keys for this page and for every page.</Dialog.Description>
            {pageList.length > 0 && <KeyList title="This page" list={pageList} />}
            <KeyList title="Everywhere" list={shownGlobals} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </HotkeysContext.Provider>
  );
}

function KeyList({ title, list }: { title: string; list: Shortcut[] }) {
  return (
    <section className="mb-3 last:mb-0">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-1">
        {list.map((s) => (
          <li key={`${title}-${s.key}`} className="flex items-center justify-between text-sm">
            <span>{s.label}</span>
            <kbd className="min-w-6 rounded border bg-muted px-1.5 py-0.5 text-center font-mono text-xs">{keyLabel(s.key)}</kbd>
          </li>
        ))}
      </ul>
    </section>
  );
}
