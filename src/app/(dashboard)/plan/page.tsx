import { ownerForSignedInUser } from '@/lib/owner';
import { cookies } from 'next/headers';
import { loadWeek } from '@/lib/plan/queries';
import { mondayOf, todayIn } from '@/lib/plan/week.mjs';
import PlanBoard from './PlanBoard';

export const dynamic = 'force-dynamic';

const HOME_TZ = 'America/Los_Angeles';

function validTimeZone(tz: string | undefined) {
  if (!tz) return HOME_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return HOME_TZ;
  }
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const userId = await ownerForSignedInUser();
  if (!userId) return <p className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  const timeZone = validTimeZone((await cookies()).get('tz')?.value);
  const today = todayIn(timeZone);
  const { week: weekParam } = await searchParams;
  const weekStart = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? '') ? weekParam! : today);
  const week = await loadWeek(userId, weekStart, today);
  return <PlanBoard week={week} timeZone={timeZone} />;
}
