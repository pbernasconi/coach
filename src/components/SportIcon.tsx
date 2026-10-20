import { Activity, Bike, Dumbbell, Flower2, Footprints, Moon, Mountain, PersonStanding, Waves, type LucideIcon } from 'lucide-react';
import { sport } from '@/lib/sports';

// The lucide names in design/sports.json. src/lib/sports.test.mjs checks that each name there has an entry here.
const ICONS: Record<string, LucideIcon> = { Activity, Bike, Dumbbell, Flower2, Footprints, Moon, Mountain, PersonStanding, Waves };

/** A sport's icon in the sport's color. Decorative: put the sport's name in text next to it. */
export default function SportIcon({ id, className = 'h-3.5 w-3.5' }: { id: string; className?: string }) {
  const s = sport(id);
  const Icon = ICONS[s.lucide] ?? Activity;
  return <Icon aria-hidden className={`shrink-0 ${className}`} style={{ color: s.color }} strokeWidth={2.25} />;
}
