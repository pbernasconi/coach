'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PAGE_FRAME } from '@/lib/page-frame';

/** The page frame: every page has the Plan calendar's width (PAGE_FRAME). The Plan calendar fills the window: no max width, small gutters. */
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const plan = usePathname().startsWith('/plan');
  return <main className={cn(PAGE_FRAME, plan ? 'max-w-none px-2 py-2 sm:px-3' : 'py-8')}>{children}</main>;
}
