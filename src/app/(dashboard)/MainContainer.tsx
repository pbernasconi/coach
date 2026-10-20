'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** The page frame. The plan calendar uses the full window width; other pages keep a readable width. */
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const wide = usePathname().startsWith('/plan');
  return (
    <main className={cn('mx-auto px-4 sm:px-6', wide ? 'max-w-[1920px] py-4 lg:px-6' : 'container max-w-7xl py-8 lg:px-8')}>
      {children}
    </main>
  );
}
