/** The scroll numbers `farFromBottom` reads (an element, or a plain object in tests). */
export type ScrollBox = { scrollTop: number; scrollHeight: number; clientHeight: number }

/** True when the view is more than `screens` of its own heights above the bottom of its content. */
export function farFromBottom(box: ScrollBox, screens = 1.5): boolean {
  const gap = box.scrollHeight - box.scrollTop - box.clientHeight
  return box.clientHeight > 0 && gap > box.clientHeight * screens
}
