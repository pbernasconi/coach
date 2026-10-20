import data from '../../design/sports.json';

/** A sport group. The list, labels, colors and icons live in design/sports.json, shared with iOS. */
export type SportId = 'ride' | 'run' | 'hike' | 'walk' | 'strength' | 'swim' | 'yoga' | 'other' | 'rest';

export type Sport = { id: SportId; label: string; color: string; lucide: string };

/** Every sport in chart stack order (bottom first). `color` is the CSS token, which follows light and dark mode. */
export const SPORTS: Sport[] = data.sports.map((s) => ({
  id: s.id as SportId,
  label: s.label,
  color: `var(--sport-${s.id})`,
  lucide: s.lucide,
}));

const BY_ID = new Map(SPORTS.map((s) => [s.id, s]));

/** The sport for an id; unknown ids fall back to "other". */
export function sport(id: string): Sport {
  return BY_ID.get(id as SportId) ?? BY_ID.get('other')!;
}

/** A Strava sport_type as words: "WeightTraining" → "Weight training", "VirtualRide" → "Virtual ride". */
export function stravaTypeLabel(type: string) {
  const words = type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
