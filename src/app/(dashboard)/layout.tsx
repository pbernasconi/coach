import Link from 'next/link';
import { Suspense } from 'react';
import { ownerForSignedInUser } from '@/lib/owner';
import { safe } from '@/lib/safe';
import { loadStatusCached, type Warning } from '@/lib/status';
import HotkeysProvider from '@/components/hotkeys/HotkeysProvider';
import DashboardNav from './DashboardNav';
import MainContainer from './MainContainer';

export const dynamic = 'force-dynamic';

/** The warnings banner. It streams in on its own, so the page does not wait for its status queries. */
async function StatusBanner() {
  const owner = await ownerForSignedInUser();
  // The banner is optional: if its status query fails, every page still renders (the 2026-10-19 outage).
  const warnings = owner
    ? await safe('status banner', async () => (await loadStatusCached(owner)).warnings.filter((w) => w.level !== 'info'), [] as Warning[])
    : [];
  if (warnings.length === 0) return null;
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6 lg:px-8">
        {warnings.map((w) => (
          <span key={w.text}>{w.text}</span>
        ))}
        <Link href="/settings" className="ml-auto underline underline-offset-4">Fix in Settings</Link>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HotkeysProvider>
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <Suspense fallback={null}>
          <StatusBanner />
        </Suspense>
        <MainContainer>{children}</MainContainer>
      </div>
    </HotkeysProvider>
  );
}
