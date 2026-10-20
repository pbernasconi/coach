import Link from 'next/link';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadStatus } from '@/lib/status';
import DashboardNav from './DashboardNav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await ownerForSignedInUser();
  const warnings = owner ? (await loadStatus(owner)).warnings.filter((w) => w.level !== 'info') : [];
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      {warnings.length > 0 && (
        <div className="border-b border-amber-500/40 bg-amber-500/10">
          <div className="container mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6 lg:px-8">
            {warnings.map((w) => (
              <span key={w.text}>{w.text}</span>
            ))}
            <Link href="/settings" className="ml-auto underline underline-offset-4">Fix in Settings</Link>
          </div>
        </div>
      )}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
