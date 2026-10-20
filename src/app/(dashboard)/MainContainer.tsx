'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { PAGE_FRAME } from '@/lib/page-frame';

/** The page frame: every page has the Plan calendar's width (PAGE_FRAME). The calendar sits a little closer to the nav. */
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const plan = usePathname().startsWith('/plan');
  return <main className={cn(PAGE_FRAME, plan ? 'py-4' : 'py-8')}>{children}</main>;
}
