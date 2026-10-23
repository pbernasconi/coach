'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/lift', label: 'Overview' },
  { href: '/lift/weekly', label: 'Weekly volume' },
];

/** The Lift sub-pages, the current one underlined like the main nav. */
export default function LiftNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-4 text-sm font-medium">
      {LINKS.map((l) => {
        const on = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center border-b-2 transition-colors hover:text-foreground md:h-8',
              on ? 'border-brand text-foreground' : 'border-transparent text-foreground/60'
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
