import { Check, Circle, CircleDashed, X, type LucideIcon } from 'lucide-react';
import { LEVEL_LABEL } from '@/lib/plan/compliance.mjs';

/** The colour token and icon for each compliance level (src/lib/plan/compliance.mjs). */
export const LEVEL_STYLE: Record<string, { color: string; Icon: LucideIcon }> = {
  good: { color: 'var(--plan-good)', Icon: Check },
  done: { color: 'var(--plan-good)', Icon: Check },
  // Partly done is still a session done: a check, in yellow.
  partial: { color: 'var(--plan-partial)', Icon: Check },
  off: { color: 'var(--plan-partial)', Icon: Check },
  // Missed and skipped are one state on the calendar: not done.
  missed: { color: 'var(--plan-missed)', Icon: X },
  skipped: { color: 'var(--plan-missed)', Icon: X },
  rest: { color: 'var(--plan-idle)', Icon: Circle },
  today: { color: 'var(--plan-idle)', Icon: CircleDashed },
  planned: { color: 'var(--plan-idle)', Icon: CircleDashed },
};

export const levelStyle = (level: string) => LEVEL_STYLE[level] ?? LEVEL_STYLE.planned;

/** A status icon in the level colour. The label goes to screen readers and the tooltip; `showLabel` prints it.
 *  `tooltip={false}` drops the hover tooltip (calendar cards) and reads `title` to screen readers instead. */
export default function ComplianceMark({ level, title, showLabel = false, tooltip = true }: { level: string; title?: string; showLabel?: boolean; tooltip?: boolean }) {
  const { color, Icon } = levelStyle(level);
  const label = (LEVEL_LABEL as Record<string, string>)[level] ?? level;
  return (
    <span className="inline-flex items-center gap-1" title={tooltip ? title ?? label : undefined}>
      <Icon aria-hidden className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2.75} />
      {showLabel ? <span className="text-[var(--viz-ink-2)]">{label}</span> : <span className="sr-only">{tooltip ? label : title ?? label}</span>}
    </span>
  );
}

/** The legend for the compliance colours. */
export function ComplianceLegend() {
  const items: [string, string][] = [
    ['good', 'Done (80–120 % of the plan)'],
    ['partial', 'Partly done'],
    ['missed', 'Not done'],
    ['planned', 'Planned'],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--viz-ink-2)]">
      {items.map(([level, label]) => {
        const { color, Icon } = levelStyle(level);
        return (
          <span key={level} className="inline-flex items-center gap-1">
            <span className="h-3 w-1 rounded-full" style={{ background: color }} />
            <Icon aria-hidden className="h-3 w-3" style={{ color }} strokeWidth={2.75} />
            {label}
          </span>
        );
      })}
    </div>
  );
}
