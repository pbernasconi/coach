// jsdom has no ResizeObserver. Radix measures the tooltip caret with one.
// Import this file before a test that renders a tooltip caret.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
