/** The words of `FullScreenWizard`. Every one has a plain English default that the caller can replace. */
export interface WizardLabels {
  back: string
  next: string
  submit: string
  close: string
  /** The name of the step list landmark. */
  steps: string
  /** Read before a finished step's name, so the state is not shown by the check icon alone. */
  done: string
  /** "Step 2 of 4". */
  stepCount: (current: number, total: number) => string
}

export const DEFAULT_WIZARD_LABELS: WizardLabels = {
  back: 'Back',
  next: 'Next',
  submit: 'Submit',
  close: 'Close',
  steps: 'Steps',
  done: 'Done:',
  stepCount: (current, total) => `Step ${current} of ${total}`,
}

/** The default labels with the caller's replacements on top. */
export const wizardLabels = (overrides: Partial<WizardLabels> = {}): WizardLabels => ({
  ...DEFAULT_WIZARD_LABELS,
  ...overrides,
})

/** Where a step sits against the current one. */
export type WizardStepState = 'done' | 'current' | 'upcoming'

export const wizardStepState = (index: number, currentStep: number): WizardStepState =>
  index < currentStep ? 'done' : index === currentStep ? 'current' : 'upcoming'
