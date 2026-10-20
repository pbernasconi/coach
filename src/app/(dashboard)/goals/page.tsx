import { cookies } from 'next/headers';
import { ownerForSignedInUser } from '@/lib/owner';
import { loadEventsWithCountdown } from '@/lib/performance/events';
import { todayIn } from '@/lib/plan/week.mjs';
import GoalsEditor from './GoalsEditor';

export const dynamic = 'force-dynamic';

function zone(tz: string | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {}
  return 'America/Los_Angeles';
}

export default async function GoalsPage() {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p data-smoke="goals" className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const today = todayIn(zone((await cookies()).get('tz')?.value));
  const { upcoming, past } = await loadEventsWithCountdown(userId, today);
  return (
    <div className="space-y-6" data-smoke="goals">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Events and goals</h1>
        <p className="text-muted-foreground">Races and target days. A is the main event of the season; B and C are build-up events.</p>
      </div>
      <GoalsEditor upcoming={upcoming} past={past} />
    </div>
  );
}
