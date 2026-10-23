'use client';

import { useEffect, useState } from 'react';

/**
 * The section list beside the settings on wide screens. It marks the section on screen; on phones the page is one
 * column and the list is hidden.
 */
export default function SettingsNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | undefined>(sections[0]?.id);

  // The active section is the last one whose top is in the upper third of the window (or the last one at the bottom),
  // so the highlight moves as soon as a section fills the screen rather than once it reaches the header. A clicked
  // link stays marked until the reader scrolls by hand: short sections near the end can never reach the top.
  useEffect(() => {
    let pinned: string | undefined;
    const update = () => {
      if (pinned) return setActive(pinned);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const line = Math.max(120, window.innerHeight / 3);
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(atBottom ? sections.at(-1)?.id : current);
    };
    const onClick = (e: MouseEvent) => {
      const id = (e.target as HTMLElement | null)?.closest?.('a[data-settings-section]')?.getAttribute('data-settings-section');
      if (id) {
        pinned = id;
        setActive(id);
      }
    };
    const unpin = () => {
      pinned = undefined;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    document.addEventListener('click', onClick);
    for (const ev of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(ev, unpin, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('click', onClick);
      for (const ev of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(ev, unpin);
    };
  }, [sections]);

  return (
    <nav aria-label="Settings sections" className="hidden lg:block">
      <ul className="sticky top-24 space-y-0.5 text-sm">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              data-settings-section={s.id}
              aria-current={active === s.id ? 'true' : undefined}
              className={`block rounded-md px-2 py-1.5 transition-colors hover:bg-muted ${
                active === s.id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
