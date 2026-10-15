import KoboTokens
import SwiftUI

extension View {
    /// Sets `isShown` while `isBusy`, and for at least `Motion.Duration.spinnerHold` after `isBusy` last rose or
    /// `taps` last changed (the control counts its taps, so the hold starts on the tap itself).
    func spinnerHold(
        isBusy: Bool,
        taps: Int,
        isShown: Binding<Bool>,
        clock: any Clock<Duration> = ContinuousClock()
    ) -> some View {
        modifier(SpinnerHoldModifier(isBusy: isBusy, taps: taps, isShown: isShown, clock: clock))
    }
}

/// Keeps a `SpinnerHold` for one control. The hold task is keyed on the count of starts, not on `isBusy`, so the end
/// of the work never cancels the hold; a new start (the work rising again, or a tap) restarts it.
private struct SpinnerHoldModifier: ViewModifier {
    let isBusy: Bool
    let taps: Int
    let isShown: Binding<Bool>
    let clock: any Clock<Duration>
    @State private var hold = SpinnerHold()
    @State private var starts = 0

    func body(content: Content) -> some View {
        content
            .onChange(of: isBusy, initial: true) { _, busy in
                if busy && !hold.isBusy { starts += 1 }
                hold = hold.busyChanged(busy)
                isShown.wrappedValue = hold.isShown
            }
            .onChange(of: taps) {
                starts += 1
                hold = hold.started()
                isShown.wrappedValue = hold.isShown
            }
            .task(id: starts) {
                guard starts > 0 else { return }
                await SpinnerHold.timer(clock: clock) {
                    hold = hold.holdEnded()
                    isShown.wrappedValue = hold.isShown
                }
            }
    }
}
