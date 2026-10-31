'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useHotkeys } from '@/components/hotkeys/HotkeysProvider';
import { useCoachChat, type CoachChatState } from './useCoachChat';

type CoachContext = { open: boolean; setOpen: (open: boolean) => void; toggle: () => void; chat: CoachChatState; onCoachPage: boolean };

const Context = createContext<CoachContext | null>(null);
const OPEN_KEY = 'coach-panel-open';

/** The Coach panel's state on every page: open or not (kept in this browser), and one chat the panel and /coach share. */
export function useCoach() {
  const c = useContext(Context);
  if (!c) throw new Error('useCoach outside CoachProvider');
  return c;
}

/**
 * Holds the web Coach chat for the dashboard: the side panel's open state (`c` toggles it), and the chat itself, so a
 * conversation carries on across pages and into the full /coach page. An Apply or Undo refreshes the page's data.
 */
export default function CoachProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const onCoachPage = usePathname() === '/coach';
  const [open, setOpenState] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === '1') setOpenState(true);
    } catch { /* storage blocked: start closed */ }
  }, []);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch { /* storage blocked */ }
  }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const chat = useCoachChat(open || onCoachPage, refresh);
  useHotkeys(onCoachPage ? [] : [{ key: 'c', label: open ? 'Close Coach' : 'Ask Coach', run: toggle }]);

  const value = useMemo(() => ({ open, setOpen, toggle, chat, onCoachPage }), [open, setOpen, toggle, chat, onCoachPage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
