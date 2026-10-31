import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** The Kobo type roles. tailwind-merge must know them, or it drops `text-title` when a `text-ink` follows it. */
export const TEXT_ROLES = ['display', 'title', 'title2', 'headline', 'reading', 'body', 'subhead', 'footnote', 'caption'] as const

const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TEXT_ROLES],
      radius: ['badge', 'inner', 'control', 'card', 'sheet'],
      shadow: ['card', 'float', 'toast'],
    },
    classGroups: {
      z: [{ z: ['sticky', 'nav', 'drawer', 'modal', 'popover', 'palette', 'toast'] }],
    },
  },
})

/** Joins class names and resolves Tailwind conflicts. The only way to build a `className`. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
