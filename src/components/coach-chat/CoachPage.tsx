'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import CoachChat from './CoachChat';
import { useCoach } from './CoachProvider';

/** /coach: the Coach chat in the page, filling the window under the nav (and the warnings banner, when there is one). */
export default function CoachPage() {
  const { chat } = useCoach();
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current;
      if (el) setHeight(Math.max(320, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY)));
    };
    fit();
    window.addEventListener('resize', fit);
    // The banner streams in after the page: fit again once it has.
    const late = setTimeout(fit, 1500);
    return () => {
      window.removeEventListener('resize', fit);
      clearTimeout(late);
    };
  }, []);

  return (
    <div ref={box} data-smoke="coach" className="-mt-8 -mb-8 h-[calc(100dvh-3.5rem)]" style={height ? { height } : undefined}>
      <CoachChat chat={chat} variant="page" />
    </div>
  );
}
