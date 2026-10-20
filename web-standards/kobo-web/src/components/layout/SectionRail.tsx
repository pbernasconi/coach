import * as React from 'react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export interface SectionRailItem<K extends string = string> {
  key: K
  label: string
}

export interface SectionRailProps<K extends string> {
  /** The sections in display order. Takes `as const` arrays. */
  sections: ReadonlyArray<SectionRailItem<K>>
  activeKey: K
  onSelect: (key: K) => void
  /** The name of the nav landmark, for example "Settings sections". */
  ariaLabel: string
  /** The pane of the active section. */
  children: React.ReactNode
  className?: string
}

/**
 * A section list beside its content: a row of tabs that scrolls sideways on a phone, and a rail on the left with
 * a divider from `md` up. The rail has a fixed minimum height, so the divider keeps one length when the pane
 * changes. The caller keeps the active key (often in the URL, so a section can have a link).
 *
 *     <SectionRail sections={SECTIONS} activeKey={tab} onSelect={setTab} ariaLabel="Settings sections">
 *       <Pane />
 *     </SectionRail>
 */
export function SectionRail<K extends string>({
  sections,
  activeKey,
  onSelect,
  ariaLabel,
  children,
  className,
}: SectionRailProps<K>) {
  return (
    <div className={cn('flex flex-col gap-8 md:flex-row', className)}>
      <nav
        aria-label={ariaLabel}
        className="md:min-h-64 md:w-44 md:shrink-0 md:self-start md:border-r md:border-line md:pr-4"
      >
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {sections.map((item) => {
            const active = item.key === activeKey
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full rounded-control px-3 py-2 text-left text-body whitespace-nowrap',
                    'transition-colors duration-(--motion-state) ease-standard',
                    focusRing,
                    active
                      ? 'bg-surface-sunken font-semibold text-ink'
                      : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                  )}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
