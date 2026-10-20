import { ownerForSignedInUser } from '@/lib/owner';
import { createClient, gymToday, googleCalendarLink, hasCredentials, MX3Error } from '@/lib/mx3/client.mjs';
import GymBoard, { type GymDay } from './GymBoard';

export const dynamic = 'force-dynamic';

export default async function GymPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if (!(await ownerForSignedInUser())) return <p className="text-sm text-muted-foreground">This account has no Coach data.</p>;
  if (!hasCredentials()) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Gym</h1>
        <p className="text-sm text-muted-foreground">
          Add <code>MX3_USERNAME</code> and <code>MX3_PASSWORD</code> to the app&apos;s environment variables to book MX3 stations here.
        </p>
      </div>
    );
  }

  const { date: wanted } = await searchParams;
  let day: GymDay;
  try {
    const mx3 = createClient();
    const page = await mx3.overview();
    const today = gymToday();
    const days = page.days.map((d) => d.date).filter((d) => d >= today);
    const date = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) ? wanted : (days[0] ?? today);
    const sched = await mx3.schedule(date, { page });
    day = {
      date,
      days: days.length ? days : [date],
      credits: sched.credits,
      reservations: sched.reservations.map((r) => ({ ...r, calendarLink: googleCalendarLink(r) })),
      slots: sched.slots
        .filter((s) => s.status === 'available' || s.status === 'mine')
        .map(({ station, time, status }) => ({ station, time, status })),
    };
  } catch (e) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Gym</h1>
        <p className="text-sm text-destructive">{e instanceof MX3Error ? e.message : 'Could not reach MX3.'}</p>
      </div>
    );
  }
  return <GymBoard day={day} />;
}
