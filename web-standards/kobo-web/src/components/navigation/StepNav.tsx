import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { focusRing } from '../controls/Button'

export interface StepNavStep {
  label: string
}

export interface StepNavProps {
  steps: StepNavStep[]
  /** The index of the active step. Pass `steps.length` when every step is done. */
  currentStep: number
  /** Makes the steps buttons that go to a step. Without it the steps are shown but cannot be picked. */
  onStepClick?: (index: number) => void
  /** Vertical (the default) is the rail of a wizard; horizontal is a compact progress row. */
  orientation?: 'vertical' | 'horizontal'
  /** Horizontal only: a check in place of the number on finished steps. */
  showCheckmarks?: boolean
  /** The name of the nav landmark, for example "Progress". */
  'aria-label'?: string
  className?: string
}

/**
 * The steps of a flow, with the current one marked (`aria-current="step"`). Vertical shows a bar on the current
 * step; horizontal shows numbered circles joined by lines, with the labels from `md` up.
 *
 *     <StepNav steps={[{ label: 'Details' }, { label: 'Review' }]} currentStep={1} onStepClick={goTo} aria-label="Progress" />
 */
export function StepNav({
  steps,
  currentStep,
  onStepClick,
  orientation = 'vertical',
  showCheckmarks = false,
  'aria-label': ariaLabel,
  className,
}: StepNavProps) {
  if (orientation === 'horizontal') {
    return (
      <nav aria-label={ariaLabel} className={cn('flex items-center', className)}>
        {steps.map((step, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          return (
            <div key={index} className="flex items-center">
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                disabled={!onStepClick}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-control',
                  focusRing,
                  onStepClick && isCompleted ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border text-footnote font-semibold',
                    isCompleted && 'border-brand bg-brand text-on-brand',
                    isActive && 'border-brand text-brand-ink ring-2 ring-brand/15',
                    !isCompleted && !isActive && 'border-line-strong text-ink-muted',
                  )}
                >
                  {showCheckmarks && isCompleted ? <Check className="size-3" /> : index + 1}
                </span>
                {/* The label is visible from md up; below it, a screen reader still reads it. */}
                <span
                  className={cn(
                    'sr-only text-body md:not-sr-only',
                    isActive ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn('mx-2 h-px w-4 md:w-6', isCompleted ? 'bg-brand' : 'bg-line')}
                />
              )}
            </div>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label={ariaLabel} className={cn('flex flex-col gap-0.5', className)}>
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const isFuture = index > currentStep
        return (
          <button
            key={index}
            type="button"
            onClick={() => onStepClick?.(index)}
            disabled={!onStepClick}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'flex items-center border-l-[3px] px-4 py-2 text-left text-body',
              'transition-colors duration-(--motion-state) ease-standard',
              focusRing,
              isActive && 'border-brand font-semibold text-ink',
              isCompleted && 'border-transparent text-ink-muted hover:text-ink',
              isFuture && 'border-transparent text-ink-faint',
              onStepClick && !isFuture ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            <span
              aria-hidden="true"
              className="mr-3 flex size-6 shrink-0 items-center justify-center rounded-full text-footnote font-semibold"
            >
              {index + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}
