import Link from 'next/link';
import { CalendarDays, Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Week board or month calendar. The view lives in the URL (?view=month&month=YYYY-MM). */
export default function ViewToggle({ view, weekHref, monthHref }: { view: 'week' | 'month'; weekHref: string; monthHref: string }) {
  const item = (active: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
      active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    );
  return (
    <nav aria-label="Plan view" className="inline-flex rounded-lg border bg-muted/50 p-0.5">
      <Link href={weekHref} className={item(view === 'week')} aria-current={view === 'week' ? 'page' : undefined}>
        <Columns3 aria-hidden className="h-4 w-4" /> Week
      </Link>
      <Link href={monthHref} className={item(view === 'month')} aria-current={view === 'month' ? 'page' : undefined}>
        <CalendarDays aria-hidden className="h-4 w-4" /> Month
      </Link>
    </nav>
  );
}
