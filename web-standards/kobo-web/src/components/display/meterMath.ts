import type { Tone } from '../../lib/tone'

/** Clamps a fill to 0…1. A value that is not finite is 0. */
export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * The tone of a meter from thresholds: success under `warnAt`, warning under `dangerAt`, danger above.
 * `higherIsBetter` turns the scale round (danger when low).
 */
export function meterTone(
  fraction: number,
  options: { warnAt?: number; dangerAt?: number; higherIsBetter?: boolean } = {},
): Tone {
  const { warnAt = 0.5, dangerAt = 0.8, higherIsBetter = false } = options
  const value = clampFraction(fraction)
  const band = value < warnAt ? 0 : value < dangerAt ? 1 : 2
  const scale: Tone[] = higherIsBetter ? ['danger', 'warning', 'success'] : ['success', 'warning', 'danger']
  return scale[band] ?? 'neutral'
}
