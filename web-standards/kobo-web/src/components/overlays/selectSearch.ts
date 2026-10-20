/**
 * The search rank of a picker option. The cases are tests/vectors/select-search.json.
 *
 * Rank: an exact keyword (4) > a label prefix (3) > a keyword prefix (2) > a label or description substring (1).
 * Rank 0 hides the option. Matching ignores case after the query is trimmed. Equal ranks keep the option order.
 * An empty query keeps every option in order.
 */

export interface SearchableOption {
  label: string
  /** Short exact names, such as an ISO country code. "CH" finds Switzerland. */
  keywords?: readonly string[]
  description?: string
}

/** The rank of one option for a query: 0 to 4. An empty query ranks every option 1. */
export function rankOption(option: SearchableOption, search: string): number {
  const query = search.trim().toLowerCase()
  if (!query) return 1
  const label = option.label.toLowerCase()
  const keywords = (option.keywords ?? []).map((keyword) => keyword.toLowerCase())
  if (keywords.includes(query)) return 4
  if (label.startsWith(query)) return 3
  if (keywords.some((keyword) => keyword.startsWith(query))) return 2
  if (label.includes(query)) return 1
  if (option.description?.toLowerCase().includes(query)) return 1
  return 0
}

/** The options that match a query, best rank first. Equal ranks keep their order. */
export function searchOptions<T extends SearchableOption>(options: readonly T[], search: string): T[] {
  return options
    .map((option, index) => ({ option, index, rank: rankOption(option, search) }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.option)
}

/**
 * The same rank as a cmdk `filter`. Give each `CommandItem` its label as `value` and its exact names as `keywords`.
 *
 *     <Command filter={commandFilter}>…<CommandItem value="Switzerland" keywords={['CH']} />…</Command>
 */
export function commandFilter(value: string, search: string, keywords?: string[]): number {
  return rankOption({ label: value, keywords }, search)
}
