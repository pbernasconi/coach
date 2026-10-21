/**
 * A change with its sign as a glyph, coloured by whether it went the good way (never colour alone). `%` changes
 * read as points.
 */
export default function Delta({
  value,
  digits,
  unit,
  better,
  label,
}: {
  value: number | null;
  digits: number;
  unit: string;
  better: 'up' | 'down' | null;
  label?: string;
}) {
  if (value === null) return null;
  const flat = Math.abs(value) < 10 ** -digits / 2;
  const good = better === null || flat ? null : (value < 0) === (better === 'down');
  const color = good === null ? 'var(--viz-muted)' : good ? 'var(--viz-good)' : 'var(--viz-down)';
  const glyph = flat ? '→' : value > 0 ? '▲' : '▼';
  return (
    <span className="whitespace-nowrap tabular-nums" style={{ color }}>
      {glyph} {Math.abs(value).toFixed(digits)}
      {unit === '%' ? ' pts' : unit ? ` ${unit}` : ''}
      {label && <span className="text-[var(--viz-muted)]"> {label}</span>}
    </span>
  );
}
