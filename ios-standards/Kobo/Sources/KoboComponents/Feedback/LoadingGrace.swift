import Foundation
import KoboTokens

/// The life of a placeholder (a skeleton, a spinner): invisible for `Motion.Duration.loadingGrace`, so a fast load
/// shows nothing at all, then shown, then held for `Motion.Duration.placeholderHold`, so content that arrives just
/// after it appeared does not make it flash. `.loadingGrace()` and `LoadableView` use it. Pure, so tests drive it with
/// a manual clock.
nonisolated public enum LoadingGrace: Sendable, Equatable, CaseIterable {
    /// Inside the grace period: the placeholder is invisible, and content that arrives now replaces it at once.
    case waiting
    /// The placeholder shows, and has not yet shown for the hold: content waits for the hold to end.
    case shown
    /// The placeholder has shown for at least the hold: content replaces it at once.
    case held

    /// How long a placeholder stays invisible.
    public static let grace: Duration = .milliseconds(Int(Motion.Duration.loadingGrace * 1_000))
    /// How long a placeholder that did show stays at least.
    public static let hold: Duration = .milliseconds(Int(Motion.Duration.placeholderHold * 1_000))

    /// The placeholder is on screen.
    public var isVisible: Bool { self != .waiting }

    /// Content that is ready must still wait behind the placeholder.
    public var holdsContent: Bool { self == .shown }

    /// The timer of one wait: it sleeps on `clock` to the end of the grace and reports `.shown`, then to the end of the
    /// hold and reports `.held`. A cancelled sleep reports nothing more.
    public static func timer(clock: any Clock<Duration>, onStage: (LoadingGrace) -> Void) async {
        for (wait, stage) in [(grace, LoadingGrace.shown), (hold, .held)] {
            guard (try? await clock.sleep(for: wait)) != nil, !Task.isCancelled else { return }
            onStage(stage)
        }
    }
}
