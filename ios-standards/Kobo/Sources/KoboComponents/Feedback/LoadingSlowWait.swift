import Foundation

/// How long a wait has lasted, in the stages that change what it should say. A spinner alone is enough at first;
/// after `slowAfter` the wait says it is still working, and after `verySlowAfter` it admits it is taking longer than
/// usual. `LoadingState` and `.slowWait(isWaiting:stage:)` use it.
nonisolated public enum SlowWait: Sendable, Equatable, CaseIterable {
    /// A normal wait: no copy beyond the spinner's own.
    case none
    /// Past `slowAfter`: say it is still working.
    case slow
    /// Past `verySlowAfter`: say it is taking longer than usual.
    case verySlow

    /// Before this, a spinner alone is enough.
    public static let slowAfter: Duration = .seconds(2)
    /// After this, the wait is unusually long.
    public static let verySlowAfter: Duration = .seconds(15)

    /// The stage of a wait that has lasted `elapsed`.
    public static func stage(elapsed: Duration) -> SlowWait {
        if elapsed >= verySlowAfter { return .verySlow }
        return elapsed >= slowAfter ? .slow : .none
    }

    /// The timer of one wait: it sleeps on `clock` to each threshold and reports the stage there. A cancelled sleep
    /// reports nothing more.
    static func timer(clock: any Clock<Duration>, onStage: (SlowWait) -> Void) async {
        var elapsed: Duration = .zero
        for threshold in [slowAfter, verySlowAfter] {
            guard (try? await clock.sleep(for: threshold - elapsed)) != nil, !Task.isCancelled else { return }
            elapsed = threshold
            onStage(stage(elapsed: elapsed))
        }
    }
}
