'use client';

import { useRouter } from 'next/navigation';
import { useHotkeys } from './HotkeysProvider';

type LinkKey = { key: string; label: string; href: string | null | undefined };

/**
 * Shortcuts that open links, for server pages: `<LinkHotkeys links={[{ key: '[', label: 'Older session', href }]} />`.
 * A link without an href (no older session) is left out. Renders nothing.
 */
export default function LinkHotkeys({ links }: { links: LinkKey[] }) {
  const router = useRouter();
  useHotkeys(
    links.filter((l): l is LinkKey & { href: string } => Boolean(l.href)).map((l) => ({ key: l.key, label: l.label, run: () => router.push(l.href) }))
  );
  return null;
}
