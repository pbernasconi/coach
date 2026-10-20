import { formatDay } from '@/lib/lift-dashboard/format';

/** "Sep 28, 2026" on a phone, "Mon, Sep 28, 2026" from the sm breakpoint up: the weekday costs a table column. */
export default function ResponsiveDay({ day }: { day: string }) {
  const full = formatDay(day);
  return (
    <>
      <span className="sm:hidden">{full.replace(/^[A-Za-z]+, /, '')}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}
