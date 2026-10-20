import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'
import { wizardStepState } from './wizardLabels'

export interface WizardStepRailProps {
  steps: ReadonlyArray<{ id: string; label: string }>
  currentStep: number
  /** Called with the index of a finished step the person picks. Steps ahead cannot be picked. */
  onStepChange: (step: number) => void
  /** The name of the nav landmark. */
  label?: string
  /** Read before a finished step's name. */
  doneLabel?: string
}

/**
 * The left rail of a wizard: numbered steps, a check on finished steps, and a bar on the current one.
 * A finished step is a button that goes back to it. Hidden below `md`, where the wizard shows "Step n of N".
 */
export function WizardStepRail({
  steps,
  currentStep,
  onStepChange,
  label = 'Steps',
  doneLabel = 'Done:',
}: WizardStepRailProps) {
  return (
    <nav aria-label={label} className="hidden w-56 shrink-0 border-r border-line px-4 py-6 md:block">
      <ol className="flex flex-col gap-1">
        {steps.map((step, index) => {
          const state = wizardStepState(index, currentStep)
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={() => {
                  if (state === 'done') onStepChange(index)
                }}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-body',
                  'transition-colors duration-(--motion-state) ease-standard',
                  focusRing,
                  state === 'current' && 'font-semibold text-ink',
                  state === 'done' && 'cursor-pointer text-ink-muted hover:bg-surface-raised',
                  state === 'upcoming' && 'cursor-default text-ink-muted',
                )}
              >
                {state === 'current' && (
                  <span aria-hidden="true" className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                )}
                {state === 'done' ? (
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink"
                  >
                    <Check className="size-3.5" />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-footnote font-semibold',
                      state === 'current' ? 'bg-brand text-on-brand' : 'border border-line-strong text-ink-muted',
                    )}
                  >
                    {index + 1}
                  </span>
                )}
                {state === 'done' && <span className="sr-only">{doneLabel}</span>}
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
