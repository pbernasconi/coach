/** "200+" when the count is a floor (the source stopped counting), "200" when it is the full total. */
export const formatPillCount = (count: number, countIsExact?: boolean): string =>
  countIsExact === false ? `${count}+` : `${count}`
