'use client';

import CoachChat from './CoachChat';
import { useCoach } from './CoachProvider';

/**
 * The Coach chat docked on the right of every dashboard page, under the nav: the page narrows to make room (desktop);
 * on a phone it covers the page. Hidden on /coach, which shows the same chat full size.
 */
export default function CoachPanel() {
  const { open, setOpen, chat, onCoachPage } = useCoach();
  if (!open || onCoachPage) return null;
  return (
    <aside
      aria-label="Coach"
      className="fixed inset-x-0 top-14 bottom-0 z-40 border-l border-line bg-background md:sticky md:inset-auto md:top-14 md:z-auto md:h-[calc(100dvh-3.5rem)] md:w-[26rem] md:shrink-0 lg:w-[30rem]"
    >
      <CoachChat chat={chat} variant="panel" onClose={() => setOpen(false)} />
    </aside>
  );
}
