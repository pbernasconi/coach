'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, CircleHelp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TONE_CLASS } from '../../lib/tone'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../overlays/Popover'
import {
  MIN_STRENGTH,
  PASSWORD_RULES,
  STRENGTH_LABELS,
  STRENGTH_TONES,
  passwordState,
  type PasswordRule,
} from './passwordRules'

export interface PasswordRequirementsProps {
  value: string
  /** Leave it out to always show the list (a "set a password" screen). Pass a Boolean to show it on focus. */
  focused?: boolean
  /** `inline` puts the list under the field. `popover` floats it beside the field, so a dialog keeps its height. */
  presentation?: 'inline' | 'popover'
  /** The field the popover points at (popover only). */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Fires once each time the overall result (all rules and the strength gate) flips. Use it to enable submit. */
  onValidityChange?: (valid: boolean) => void
  /** The composition rules. The default is length, mixed case, a number and a symbol. */
  rules?: readonly PasswordRule[]
  /** The lowest zxcvbn score (0 to 4) that passes. Default 2. */
  minStrength?: number
  /** The meter words for scores 0 to 4. */
  strengthLabels?: readonly [string, string, string, string, string]
  /** The label of the strength rule row. */
  strengthRuleLabel?: string
  /** The help next to the strength rule. `null` removes it. */
  help?: React.ReactNode
  /** The words a screen reader hears after a pause in typing. */
  announce?: (met: number, total: number) => string
  className?: string
}

const DEFAULT_HELP = (
  <>
    <p className="text-subhead font-semibold text-ink">What makes a password strong?</p>
    <p className="mt-1 text-footnote text-ink-muted">
      Length and surprise beat complexity. A long phrase of four random words is harder to guess than a short mix of
      symbols.
    </p>
  </>
)

function RuleRow({ label, met, help }: { label: string; met: boolean; help?: React.ReactNode }) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 text-subhead transition-colors duration-(--motion-state) ease-standard',
        met ? 'text-ink' : 'text-ink-muted',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-(--motion-state) ease-standard',
          met ? 'border-success-ink bg-success-ink text-surface' : 'border-line-strong',
        )}
      >
        <Check strokeWidth={3} className={cn('size-2.5 transition-opacity', met ? 'opacity-100' : 'opacity-0')} />
      </span>
      {/* The check is hidden from screen readers, so the state is in words for them. */}
      <span className="flex items-center gap-1">
        <span>{label}</span>
        <span className="sr-only">{met ? ', met' : ', not met'}</span>
        {help}
      </span>
    </li>
  )
}

function HelpButton({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label="What makes a password strong"
        className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CircleHelp aria-hidden="true" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 p-3">
        {children}
      </PopoverContent>
    </Popover>
  )
}

/**
 * A live checklist of password rules with a strength meter. Rules go from grey to green as they pass, never red.
 * A "Hard to guess" row shows the zxcvbn gate, so a disabled submit button is never a mystery.
 *
 *     <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} />
 *     <PasswordRequirements value={pw} onValidityChange={setCanSubmit} />
 */
export function PasswordRequirements({
  value,
  focused,
  presentation = 'inline',
  anchorRef,
  onValidityChange,
  rules = PASSWORD_RULES,
  minStrength = MIN_STRENGTH,
  strengthLabels = STRENGTH_LABELS,
  strengthRuleLabel = 'Hard to guess',
  help = DEFAULT_HELP,
  announce = (met, total) => `${met} of ${total} password requirements met.`,
  className,
}: PasswordRequirementsProps) {
  const hasInput = value.length > 0
  // zxcvbn can take time on long text, so score once per value, not once per render.
  const state = React.useMemo(() => passwordState(value, rules, minStrength), [value, rules, minStrength])
  const { score, strengthMet, valid, metCount, totalCount } = state

  // Tell the parent once per flip, so it can enable submit without a render loop.
  const lastEmitted = React.useRef<boolean | null>(null)
  React.useEffect(() => {
    if (lastEmitted.current !== valid) {
      lastEmitted.current = valid
      onValidityChange?.(valid)
    }
  }, [valid, onValidityChange])

  // A polite live region: empty until the first key, and only after a pause, so a screen reader is not flooded.
  // It is outside the popover, so it speaks in both presentations.
  const [announcement, setAnnouncement] = React.useState('')
  // `announce` is often a new function each render. A ref keeps it out of the effect's dependencies.
  const announceRef = React.useRef(announce)
  announceRef.current = announce
  React.useEffect(() => {
    if (!hasInput) {
      setAnnouncement('')
      return
    }
    const timer = setTimeout(() => setAnnouncement(announceRef.current(metCount, totalCount)), 600)
    return () => clearTimeout(timer)
  }, [metCount, totalCount, hasInput])

  // Show on focus. Once there is text, it stays after blur.
  const visible = focused === undefined || focused || hasInput
  const tone = STRENGTH_TONES[score] ?? 'danger'

  const liveRegion = (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  )

  const body = (
    <>
      {hasInput && (
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-footnote font-semibold text-ink-muted">Password strength</span>
            <span className={cn('text-footnote font-semibold', strengthMet ? 'text-success-ink' : 'text-ink-muted')}>
              {strengthLabels[score]}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-(--motion-state) ease-standard',
                  index < score ? TONE_CLASS[tone].solid : 'bg-surface-sunken',
                )}
              />
            ))}
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {state.rules.map((rule) => (
          <RuleRow key={rule.id} label={rule.label} met={rule.met} />
        ))}
        <RuleRow label={strengthRuleLabel} met={strengthMet} help={help ? <HelpButton>{help}</HelpButton> : null} />
      </ul>
    </>
  )

  if (presentation === 'popover') {
    return (
      <div className={className} data-slot="password-requirements">
        {liveRegion}
        <Popover open={visible}>
          {anchorRef && <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />}
          <PopoverContent
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={12}
            // Focus stays in the field, so typing goes on.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className="w-72 p-3.5"
          >
            {body}
            <PopoverPrimitive.Arrow className="fill-surface" width={12} height={6} />
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className={className} data-slot="password-requirements">
      {liveRegion}
      {visible && <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">{body}</div>}
    </div>
  )
}
