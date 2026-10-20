import { cn } from '../../lib/cn'

export interface StepIndicatorProps {
  /** The current step, from 1. */
  currentStep: number
  totalSteps: number
  /** The name of the current step. It shows after "Step 2 of 4 —". */
  label?: string
  className?: string
  /** The words of the step count. */
  stepText?: (current: number, total: number) => string
}

/**
 * A segmented progress bar for a flow of steps, with an optional "Step 2 of 4 — Name" line.
 *
 *     <StepIndicator currentStep={2} totalSteps={4} label="Pick a date" />
 */
export function StepIndicator({
  currentStep,
  totalSteps,
  label,
  className,
  stepText = (current, total) => `Step ${current} of ${total}`,
}: StepIndicatorProps) {
  const text = stepText(currentStep, totalSteps)
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <p className="text-body text-ink-muted">
          {text} — {label}
        </p>
      )}
      <div
        className="flex gap-1"
        role="progressbar"
        aria-label={label ?? text}
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuetext={text}
      >
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-(--motion-state) ease-standard',
              i < currentStep ? 'bg-brand' : 'bg-surface-sunken',
            )}
          />
        ))}
      </div>
    </div>
  )
}
