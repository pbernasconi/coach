/** Up to two capital initials from a name: "Ada Park" → "AP". An empty name gives "?". */
export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

// Monogram avatars for other people use one quiet neutral tint. Colour is kept for the signed-in
// person (an app gives that avatar `bg-brand text-on-brand`), so "you" stand out and others recede.
// Add low-saturation tints here to tell people apart later.
const AVATAR_COLOR_CLASSES = ['bg-surface-raised text-ink-muted'] as const

/** The tint classes of a monogram avatar. The same seed always gives the same tint. */
export function getAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_COLOR_CLASSES[Math.abs(hash) % AVATAR_COLOR_CLASSES.length] ?? AVATAR_COLOR_CLASSES[0]
}
