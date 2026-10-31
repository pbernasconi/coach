'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PAGE_FRAME } from '@/lib/page-frame';

/**
 * The page frame: every page has the Plan calendar's width (PAGE_FRAME). The Plan calendar fills the window: no max
 * width, small gutters. The Coach chat page runs edge to edge, as a chat app does.
 */
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const frame = path === '/coach' ? 'max-w-none p-0 sm:px-0' : path.startsWith('/plan') ? 'max-w-none px-2 py-2 sm:px-3' : 'py-8';
  return <main className={cn(PAGE_FRAME, frame)}>{children}</main>;
}
