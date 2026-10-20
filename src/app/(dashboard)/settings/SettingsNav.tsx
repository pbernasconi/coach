'use client';

import { useEffect, useState } from 'react';

/**
 * The section list beside the settings on wide screens. It marks the section on screen; on phones the page is one
 * column and the list is hidden.
 */
export default function SettingsNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | undefined>(sections[0]?.id);

  // The active section is the last one whose top has passed under the sticky header (or the last one at the bottom).
  useEffect(() => {
    const update = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 120) current = s.id;
      }
      setActive(atBottom ? sections.at(-1)?.id : current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [sections]);

  return (
    <nav aria-label="Settings sections" className="hidden lg:block">
      <ul className="sticky top-24 space-y-0.5 text-sm">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
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
