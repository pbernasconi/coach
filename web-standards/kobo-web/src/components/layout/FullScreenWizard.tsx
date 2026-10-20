'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../controls/Button'
import { FlowShell } from './FlowShell'
import { WizardStepRail } from './WizardStepRail'
import { wizardLabels, type WizardLabels } from './wizardLabels'

export interface WizardStep {
  id: string
  label: string
  content: React.ReactNode
  /** False blocks Next (and Submit on the last step). */
  isValid?: boolean
}

export interface FullScreenWizardProps {
  steps: WizardStep[]
  currentStep: number
  onStepChange: (step: number) => void
  onClose: () => void
  onComplete: () => void
  /** The name of the task, in the header. */
  title?: string
  /** Show a spinner on Submit and block it. */
  isSubmitting?: boolean
  /** Show the step rail (and the "Step n of N" bar on a phone). */
  showStepper?: boolean
  /**
   * `fullscreen` draws its own `FlowShell`. `dialog` draws only the rail, content and footer, to put inside a
   * full-screen `DialogContent` that has its own close button.
   */
  presentation?: 'fullscreen' | 'dialog'
  /** Replace any of the words (`submit`, `next`, `stepCount`, …). */
  labels?: Partial<WizardLabels>
  /** Guards the close button and Escape (fullscreen only). See `FlowShell`. */
  beforeClose?: () => boolean | Promise<boolean>
}

/**
 * A multi-step task on its own screen: a step rail on the left, one step at a time, and Back and Next (or Submit)
 * pinned at the bottom. The caller keeps `currentStep`.
 *
 *     <FullScreenWizard title="Invite people" steps={steps} currentStep={step} onStepChange={setStep}
 *       onClose={exit} onComplete={send} labels={{ submit: 'Send invites' }} />
 */
export function FullScreenWizard({
  steps,
  currentStep,
  onStepChange,
  onClose,
  onComplete,
  title,
  isSubmitting = false,
  showStepper = true,
  presentation = 'fullscreen',
  labels: labelOverrides,
  beforeClose,
}: FullScreenWizardProps) {
  const labels = wizardLabels(labelOverrides)
  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0
  const currentStepValid = step?.isValid !== false

  const footer = (
    <footer className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {showStepper && <div aria-hidden="true" className="hidden w-56 shrink-0 md:block" />}
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4 md:px-6">
          {isFirstStep ? (
            <span />
          ) : (
            <Button variant="outline" onClick={() => onStepChange(currentStep - 1)}>
              <ChevronLeft aria-hidden="true" />
              {labels.back}
            </Button>
          )}
          {isLastStep ? (
            <Button onClick={onComplete} disabled={!currentStepValid} loading={isSubmitting}>
              <Send aria-hidden="true" />
              {labels.submit}
            </Button>
          ) : (
            <Button onClick={() => onStepChange(currentStep + 1)} disabled={!currentStepValid}>
              {labels.next}
              <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </footer>
  )

  const leftRail = showStepper ? (
    <WizardStepRail
      steps={steps}
      currentStep={currentStep}
      onStepChange={onStepChange}
      label={labels.steps}
      doneLabel={labels.done}
    />
  ) : undefined

  const content = (
    <>
      {showStepper && step && (
        // pr-14 keeps the step text clear of the dialog's close button.
        <div
          className={cn(
            'sticky top-0 z-sticky border-b border-line bg-canvas px-4 py-3 md:hidden',
            presentation === 'dialog' && 'pr-14',
          )}
        >
          <p className="text-footnote text-ink-muted">{labels.stepCount(currentStep + 1, steps.length)}</p>
          <p className="text-body font-semibold text-ink">{step.label}</p>
        </div>
      )}
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-10 md:px-6 md:pt-16">{step?.content}</div>
    </>
  )

  if (presentation === 'dialog') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {leftRail}
          <main className="min-w-0 flex-1 overflow-y-auto">{content}</main>
        </div>
        {footer}
      </div>
    )
  }

  return (
    <FlowShell
      title={title}
      onClose={onClose}
      beforeClose={beforeClose}
      closeLabel={labels.close}
      leftRail={leftRail}
      footer={footer}
    >
      {content}
    </FlowShell>
  )
}
