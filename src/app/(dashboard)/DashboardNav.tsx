'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { NAV_KEYS } from '@/lib/hotkeys.mjs';
import { cn } from '@/lib/utils';
import { PAGE_FRAME } from '@/lib/page-frame';
import CoachMark from '@/components/brand/CoachMark';

// The nav links use Next's default (partial) prefetch: the page shell and its loading.tsx, not its data. A full
// prefetch rendered all six pages, with their database reads, on every page view (Neon compute and transfer).
const navLinks = [
  { href: '/', label: 'Today' },
  { href: '/plan', label: 'Plan' },
  { href: '/lift', label: 'Lift' },
  { href: '/health', label: 'Health' },
  { href: '/settings', label: 'Settings' },
];

/** The hotkey of a nav section (src/components/hotkeys/HotkeysProvider.tsx; ? shows them all). */
const keyOf = (href: string) => NAV_KEYS.find((n) => n.href === href)?.key;

export default function DashboardNav() {
  const pathname = usePathname();
  // The current section: / only on its own, others also for their sub-pages (/health/day/… is Health).
  // Pages outside the nav belong to a section: /trends to Today, an activity to Plan.
  const section = pathname.startsWith('/trends') ? '/' : pathname.startsWith('/activities/') ? '/plan' : pathname;
  const isActive = (href: string) => (href === '/' ? section === '/' : section === href || section.startsWith(`${href}/`));
  const { isLoaded } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-wash-line bg-brand-wash/92 backdrop-blur">
      <div className={cn(PAGE_FRAME, 'flex h-14 items-center gap-2')}>
        {/* Mobile menu button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2 md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <CoachMark />
                Coach
              </SheetTitle>
            </SheetHeader>
            <nav className="-mx-3 mt-4 flex flex-col gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-md px-3 text-base transition-colors hover:text-foreground',
                    isActive(link.href) ? 'bg-brand-soft font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand-wash" aria-label="Coach, home">
          <CoachMark />
          <span className="text-[15px] font-semibold tracking-tight">Coach</span>
        </Link>

        {/* Desktop menu: the current section has a line under it, on the header's bottom edge. */}
        <nav className="hidden h-full items-stretch gap-1 text-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              title={`${link.label} · press ${keyOf(link.href)}`}
              aria-keyshortcuts={keyOf(link.href)}
              className={cn(
                'relative flex items-center rounded-md px-3 transition-colors outline-none hover:text-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand after:opacity-0 after:transition-opacity',
                isActive(link.href) ? 'font-medium text-foreground after:opacity-100' : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side. The links render at once; only the account button waits for Clerk's script. */}
        <div className="ml-auto flex items-center">
          {isLoaded ? <UserButton afterSignOutUrl="/sign-in" /> : <div className="h-7 w-7 rounded-full bg-muted" />}
        </div>
      </div>
    </header>
  );
}
