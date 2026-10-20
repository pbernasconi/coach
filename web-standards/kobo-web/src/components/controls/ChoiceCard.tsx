import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from './Button'

export interface ChoiceCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  label: string
  description?: string
  ref?: React.Ref<HTMLButtonElement>
}

/**
 * A large button for one choice of a short list, such as the first step of a flow.
 * Use `RadioCards` when the choice is a value in a form.
 *
 *     <ChoiceCard icon={FileText} label="Blank note" description="Start from nothing" onClick={…} />
 */
export function ChoiceCard({ icon: Icon, label, description, className, type = 'button', ...props }: ChoiceCardProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left text-ink',
        'transition-colors duration-(--motion-state) ease-standard',
        'hover:border-brand/40 hover:bg-brand-soft',
        'disabled:opacity-45 disabled:hover:border-line disabled:hover:bg-surface',
        focusRing,
        className,
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />}
      <span className="flex flex-col">
        <span className="text-body font-semibold">{label}</span>
        {description && <span className="text-footnote text-ink-muted">{description}</span>}
      </span>
    </button>
  )
}
