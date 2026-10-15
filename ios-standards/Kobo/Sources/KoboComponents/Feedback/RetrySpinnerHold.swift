import Foundation
import KoboTokens

/// The spinner of a control that answers a tap (Try again): it shows while the work runs and for at least
/// `Motion.Duration.spinnerHold` after the tap or the start of the work, so a fast answer (an offline refusal that
/// settles before a frame shows the work) still reads as an attempt. Reduce Motion keeps it: nothing moves. Ported
/// from Trellis's `SpinnerHold`; pure, so it is tested without rendering.
nonisolated struct SpinnerHold: Equatable, Sendable {
    private(set) var isBusy = false
    private(set) var isHolding = false

    /// The spinner shows.
    var isShown: Bool { isBusy || isHolding }

    /// The work started or stopped. A start also starts the hold.
    func busyChanged(_ busy: Bool) -> SpinnerHold {
        var next = self
        if busy && !isBusy { next.isHolding = true }
        next.isBusy = busy
        return next
    }

    /// The person tapped: the hold starts at once, even when no frame ever shows the work.
    func started() -> SpinnerHold {
        var next = self
        next.isHolding = true
        return next
    }

    /// The hold ran out: the spinner stays only while the work runs.
    func holdEnded() -> SpinnerHold {
        var next = self
        next.isHolding = false
        return next
    }

    /// How long the spinner holds at least.
    static let hold: Duration = .seconds(Motion.Duration.spinnerHold)

    /// The hold of one start: sleeps `hold` on `clock`, then reports. A cancelled sleep reports nothing.
    static func timer(clock: any Clock<Duration>, onEnd: () -> Void) async {
        guard (try? await clock.sleep(for: hold)) != nil, !Task.isCancelled else { return }
        onEnd()
    }
}
