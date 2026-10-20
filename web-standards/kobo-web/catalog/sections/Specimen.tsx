import type { ReactNode } from 'react'

/** One labelled example in the catalog. */
export function Specimen({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <h3 className="mb-2 text-footnote font-semibold text-ink-muted">{title}</h3>
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-card shadow-card">{children}</div>
    </div>
  )
}

/** The two-column grid of specimens. */
export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}
