import KoboTokens
import SwiftUI

extension View {
    /// Moves `stage` through `.slow` and `.verySlow` while `isWaiting` is true, and back to `.none` when the wait
    /// stops. The timer restarts with each new wait. Use it to give a long save or upload its own words:
    ///
    ///     @State private var wait = SlowWait.none
    ///     content.slowWait(isWaiting: isUploading, stage: $wait)
    ///     if wait == .slow { Text("Still uploading…") }
    ///
    /// - Parameter clock: the time source; tests pass a manual clock.
    public func slowWait(
        isWaiting: Bool,
        stage: Binding<SlowWait>,
        clock: any Clock<Duration> = ContinuousClock()
    ) -> some View {
        modifier(SlowWaitModifier(isWaiting: isWaiting, stage: stage, clock: clock))
    }
}

/// The `task(id:)` of `.slowWait`, inside a modifier on purpose: a public extension that returns `task(id:)` directly
/// lets another module's Release build link against an iOS 26 `task` overload descriptor the SDK does not export
/// (seen in a shipped app).
private struct SlowWaitModifier: ViewModifier {
    let isWaiting: Bool
    let stage: Binding<SlowWait>
    let clock: any Clock<Duration>

    func body(content: Content) -> some View {
        content.task(id: isWaiting) {
            stage.wrappedValue = .none
            guard isWaiting else { return }
            await SlowWait.timer(clock: clock) { stage.wrappedValue = $0 }
        }
    }
}
