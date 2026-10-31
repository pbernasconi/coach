import { useEffect, useState } from 'react'
import { MAIN_CONTENT_ID, SkipLink, cn } from '../src'
import { ChatSection } from './sections/ChatSection'
import { ControlsSection } from './sections/ControlsSection'
import { DataSection } from './sections/DataSection'
import { DisplaySection } from './sections/DisplaySection'
import { FeedbackSection } from './sections/FeedbackSection'
import { FieldsSection } from './sections/FieldsSection'
import { LayoutSection } from './sections/LayoutSection'
import { MenusSection } from './sections/MenusSection'
import { OverlaysSection } from './sections/OverlaysSection'
import { PatternsSection } from './sections/PatternsSection'
import { PickersSection } from './sections/PickersSection'
import { PrimitivesSection } from './sections/PrimitivesSection'
import { TextFieldsSection } from './sections/TextFieldsSection'
import { TokensSection } from './sections/TokensSection'

type Brand = 'system' | 'amber' | 'coach'

const SECTIONS = [
  ['tokens', 'Tokens', TokensSection],
  ['controls', 'Controls', ControlsSection],
  ['primitives', 'Primitives', PrimitivesSection],
  ['fields', 'Fields', FieldsSection],
  ['text-fields', 'Text fields', TextFieldsSection],
  ['pickers', 'Pickers', PickersSection],
  ['feedback', 'Feedback', FeedbackSection],
  ['display', 'Display', DisplaySection],
  ['data', 'Data', DataSection],
  ['overlays', 'Overlays', OverlaysSection],
  ['menus', 'Menus', MenusSection],
  ['layout', 'Layout', LayoutSection],
  ['patterns', 'Patterns', PatternsSection],
  ['chat', 'Chat', ChatSection],
] as const

/** Every Kobo web component, live, with dark-mode and brand switches. */
export function Catalog() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [brand, setBrand] = useState<Brand>('system')

  // Theme and brand go on <html>, so portals (dialogs, menus) get them too.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useEffect(() => {
    if (brand === 'system') delete document.documentElement.dataset.brand
    else document.documentElement.dataset.brand = brand
  }, [brand])

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SkipLink />
      <header className="sticky top-0 z-nav border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-gutter py-3">
          <h1 className="text-headline">Kobo web</h1>
          <nav aria-label="Sections" className="flex flex-wrap gap-1 text-subhead">
            {SECTIONS.map(([id, title]) => (
              <a key={id} href={`#${id}`} className="rounded-inner px-2 py-1 text-ink-muted hover:bg-surface-raised hover:text-ink">
                {title}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Toggle label="Dark" on={dark} onChange={setDark} />
            <Toggle label="Amber" on={brand === 'amber'} onChange={(on) => setBrand(on ? 'amber' : 'system')} />
            <Toggle label="Coach" on={brand === 'coach'} onChange={(on) => setBrand(on ? 'coach' : 'system')} />
          </div>
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto flex max-w-5xl flex-col gap-10 px-gutter py-8 outline-none">
        {SECTIONS.map(([id, title, Section]) => (
          <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
            <h2 id={`${id}-title`} className="mb-4 text-title">
              {title}
            </h2>
            <Section />
          </section>
        ))}
      </main>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'rounded-full border px-3 py-1 text-subhead font-semibold',
        on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong text-ink-muted',
      )}
    >
      {label}
    </button>
  )
}
