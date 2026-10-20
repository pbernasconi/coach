/** True when the text uses the whole limit. The counter turns to the danger tone. */
export function isAtLimit(length: number, maxLength: number): boolean {
  return length >= maxLength
}

/** True from 80% of the limit. A quiet counter then stays visible without focus. */
export function isNearLimit(length: number, maxLength: number): boolean {
  return length >= Math.ceil(maxLength * 0.8)
}
