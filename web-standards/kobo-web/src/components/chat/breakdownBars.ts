/** Each value over the biggest, 0…1. A negative or missing value is 0; all zeros stay 0. */
export function barFractions(values: number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const max = Math.max(0, ...clean)
  return clean.map((v) => (max > 0 ? v / max : 0))
}
