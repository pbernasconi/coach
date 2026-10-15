import CraftTokens
import Foundation

/// Where an `AsyncButton` is. One enum, so "loading and succeeded" can never both be true.
nonisolated enum AsyncButtonPhase: Equatable, Sendable {
    /// Waiting for a tap.
    case idle
    /// The action runs; it has not run long enough to show a spinner.
    case working
    /// The action runs and the spinner shows. `holdElapsed` once it has shown for `Motion.Duration.spinnerHold`.
    case spinning(holdElapsed: Bool)
    /// The action ended while the spinner was inside its hold; the result applies when the hold ends.
    case settling(succeeded: Bool)
    /// The success check shows.
    case succeeded

    /// What happened to the button.
    enum Event: Equatable, Sendable {
        case tapped
        case delayElapsed
        case holdElapsed
        case finished(succeeded: Bool)
        case confirmationElapsed
    }

    /// The timer a phase needs. `spinning(false)` and `settling` share the hold, so finishing mid-hold keeps the
    /// timer that is already running instead of restarting it.
    enum Timer: Equatable, Sendable {
        case off, spinnerDelay, spinnerHold, confirmation

        var duration: Duration? {
            switch self {
            case .off: nil
            case .spinnerDelay: .seconds(Motion.Duration.spinnerDelay)
            case .spinnerHold: .seconds(Motion.Duration.spinnerHold)
            case .confirmation: AsyncButtonPhase.confirmationDuration
            }
        }
    }

    /// How long the success check stays before the label returns.
    static let confirmationDuration: Duration = .seconds(1)

    var timer: Timer {
        switch self {
        case .working: .spinnerDelay
        case .spinning(holdElapsed: false), .settling: .spinnerHold
        case .succeeded: .confirmation
        case .idle, .spinning(holdElapsed: true): .off
        }
    }

    /// The spinner replaces the label.
    var showsSpinner: Bool {
        switch self {
        case .spinning, .settling: true
        case .idle, .working, .succeeded: false
        }
    }

    /// Taps are accepted only at rest, so a double tap never runs the action twice.
    var acceptsTaps: Bool { self == .idle }

    /// The next phase. `confirmsSuccess` decides whether a success shows the check or returns straight to idle.
    func reduce(_ event: Event, confirmsSuccess: Bool) -> AsyncButtonPhase {
        switch (self, event) {
        case (.idle, .tapped):
            .working
        case (.working, .delayElapsed):
            .spinning(holdElapsed: false)
        case (.working, .finished(let succeeded)), (.spinning(holdElapsed: true), .finished(let succeeded)):
            Self.done(succeeded: succeeded, confirmsSuccess: confirmsSuccess)
        case (.spinning(holdElapsed: false), .finished(let succeeded)):
            .settling(succeeded: succeeded)
        case (.spinning(holdElapsed: false), .holdElapsed):
            .spinning(holdElapsed: true)
        case (.settling(let succeeded), .holdElapsed):
            Self.done(succeeded: succeeded, confirmsSuccess: confirmsSuccess)
        case (.succeeded, .confirmationElapsed):
            .idle
        default:
            self
        }
    }

    private static func done(succeeded: Bool, confirmsSuccess: Bool) -> AsyncButtonPhase {
        succeeded && confirmsSuccess ? .succeeded : .idle
    }
}
