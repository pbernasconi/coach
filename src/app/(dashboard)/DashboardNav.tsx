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
  const wide = pathname.startsWith('/plan'); // match MainContainer's width
  // The current section: / only on its own, others also for their sub-pages (/health/day/… is Health).
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const { isLoaded } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className={`mx-auto flex h-16 items-center px-4 sm:px-6 ${wide ? 'max-w-[1920px] lg:px-6' : 'container max-w-7xl lg:px-8'}`}>
          {/* Mobile menu button */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Coach</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={`flex min-h-11 items-center rounded-md px-2 text-lg transition-colors hover:text-foreground/80 ${
                      isActive(link.href) ? 'bg-muted font-medium text-foreground' : 'text-foreground/60'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Desktop menu */}
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold text-xl">
                Coach
              </span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  title={`${link.label} · press ${keyOf(link.href)}`}
                  aria-keyshortcuts={keyOf(link.href)}
                  className={`transition-colors hover:text-foreground/80 ${isActive(link.href) ? 'text-foreground' : 'text-foreground/60'}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Mobile logo */}
          <Link href="/" className="flex md:hidden mr-auto items-center">
            <span className="font-bold text-xl">Coach</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center ml-auto space-x-2">
            {/* The links render at once; only the account button waits for Clerk's script. */}
            {isLoaded ? <UserButton afterSignOutUrl="/sign-in" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
          </div>
        </div>
      </header>
    </>
  );
}
