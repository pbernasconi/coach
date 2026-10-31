/** One past chat in a history list. */
export type ChatHistoryItem = { id: string; title: string; updatedAt: string | null }

/** Past chats under one heading ("Today", "Previous 7 days"). */
export type ChatHistoryGroup = { label: string; items: ChatHistoryItem[] }

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/**
 * Past chats grouped by age, as the big assistants list them: Today, Yesterday, Previous 7 days, Previous 30 days,
 * then by month ("September", or "September 2025" in another year). Order inside a group is kept; empty groups are
 * left out. A chat without a time goes under Older.
 */
export function historyGroups(items: ChatHistoryItem[], now: Date = new Date(), locale = 'en-US'): ChatHistoryGroup[] {
  const today = startOfDay(now)
  const day = 86_400_000
  const groups: ChatHistoryGroup[] = []
  const add = (label: string, item: ChatHistoryItem) => {
    const last = groups.find((g) => g.label === label)
    if (last) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  for (const item of items) {
    const d = item.updatedAt ? new Date(item.updatedAt) : null
    if (!d || Number.isNaN(d.getTime())) {
      add('Older', item)
      continue
    }
    const t = startOfDay(d)
    if (t >= today) add('Today', item)
    else if (t >= today - day) add('Yesterday', item)
    else if (t >= today - 7 * day) add('Previous 7 days', item)
    else if (t >= today - 30 * day) add('Previous 30 days', item)
    else {
      const sameYear = d.getFullYear() === now.getFullYear()
      add(d.toLocaleDateString(locale, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' }), item)
    }
  }
  return groups
}
