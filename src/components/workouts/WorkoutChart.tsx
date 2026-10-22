import { clock, flatten, intensity, stepSeconds, targetText, zoneOf } from '@/lib/workouts/steps.mjs';
import type { StructuredWorkout } from '@/lib/plan/queries';

type Step = {
  kind: string;
  duration: { type: string; s?: number; m?: number };
  target: { type: string; low?: number; high?: number };
  ramp?: boolean;
  notes?: string;
  rep?: string;
};

/** Zone colors, as in TrainingPeaks and Zwift: grey, blue, green, yellow, red. */
export const ZONE_COLOR: Record<string, string> = { Z1: '#9ca3af', Z2: '#3b82f6', Z3: '#22c55e', Z4: '#f59e0b', Z5: '#ef4444' };

/**
 * The workout as an interval chart: one bar per step, its width the time and its height the intensity, colored by
 * zone. A ramp is a slope. Hover a bar for the step. Distance steps are drawn at an estimated pace.
 */
export default function WorkoutChart({ workout, height = 120, className = 'h-28 w-full' }: { workout: StructuredWorkout; height?: number; className?: string }) {
  const flat = flatten(workout.steps as never[]) as Step[];
  const secs = flat.map((s) => Math.max(stepSeconds(s as never), s.duration.type === 'lap' ? 300 : 0));
  const total = secs.reduce((a, b) => a + b, 0) || 1;
  const top = Math.max(1.25, ...flat.map((s) => (s.target.high ?? 0) / 100));
  const y = (f: number) => height - (Math.min(f, top) / top) * height;
  let x = 0;
  const W = 1000;
  const bars = flat.map((s, i) => {
    const w = (secs[i] / total) * W;
    const x0 = x;
    x += w;
    const open = s.target.type === 'open' || s.target.type === 'pace';
    const lo = open ? 0.5 : (s.target.low ?? 50) / 100;
    const hi = open ? 0.5 : (s.target.high ?? 50) / 100;
    const mid = open ? (s.kind === 'work' ? 1.1 : 0.5) : (intensity(s.target as never) ?? 0.5);
    const zone = open && s.kind === 'work' ? 'Z5' : zoneOf(s.target as never, workout.sport);
    const label = `${s.rep ? `${s.rep} · ` : ''}${clock(secs[i])} · ${targetText(s.target as never)}${s.notes ? ` · ${s.notes}` : ''}`;
    const gap = w > 3 ? 0.6 : 0;
    const points = s.ramp
      ? `${x0 + gap},${height} ${x0 + gap},${y(lo)} ${x0 + w - gap},${y(hi)} ${x0 + w - gap},${height}`
      : `${x0 + gap},${height} ${x0 + gap},${y(mid)} ${x0 + w - gap},${y(mid)} ${x0 + w - gap},${height}`;
    return (
      <polygon key={i} points={points} fill={ZONE_COLOR[zone]} opacity={0.9}>
        <title>{label}</title>
      </polygon>
    );
  });
  const ftpLine = y(1);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={`${workout.name}: interval chart`}>
      <line x1={0} x2={W} y1={ftpLine} y2={ftpLine} stroke="var(--viz-axis)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {bars}
    </svg>
  );
}
