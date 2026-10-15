import Foundation
import KoboTokens

/// What an outcome screen shows, in the order a submit moves through it: `loading` before anything is known (a
/// skeleton, never "we couldn't confirm"), `pending` while the work is accepted but not finished, then one of
/// `success`, `failure` or `unknown` (the answer did not come back in time, so it may still go through).
nonisolated public enum OutcomePhase: Hashable, Sendable, CaseIterable {
    case loading
    case pending
    case success
    case failure
    case unknown

    /// The phase for a flow's state: a result wins; with none, `unknown` only once the flow gave up waiting, and
    /// `pending` once the work was accepted.
    public static func of(result: Bool?, isAccepted: Bool, gaveUp: Bool) -> OutcomePhase {
        if let result { return result ? .success : .failure }
        if gaveUp { return .unknown }
        return isAccepted ? .pending : .loading
    }

    /// The tone of the hero and the status; the glyph and the title always say it too.
    public var tone: Tone {
        switch self {
        case .loading, .pending: .neutral
        case .success: .success
        case .failure: .danger
        case .unknown: .warning
        }
    }

    /// The SF Symbol of the hero. A success draws its check stroke by stroke instead (`OutcomeCheck`).
    public var symbol: String {
        switch self {
        case .loading, .pending: "hourglass"
        case .success: "checkmark"
        case .failure: "xmark"
        case .unknown: "questionmark"
        }
    }

    /// A settled phase: the entrance runs, the haptic plays, the actions are final.
    public var isSettled: Bool {
        switch self {
        case .loading, .pending: false
        case .success, .failure, .unknown: true
        }
    }
}

/// The one haptic an outcome plays when its entrance lands. Kept free of SwiftUI so it is tested on Linux; the view
/// maps it to `HapticFeedback`.
nonisolated enum OutcomeLandingFeedback: Equatable, Sendable {
    case success, warning, error

    /// The haptic for a landed `phase`, or `nil` when one already played or the phase is not settled. It plays once per
    /// outcome: never again on a re-render, a restored screen or a refresh.
    static func of(_ phase: OutcomePhase, hasPlayed: Bool) -> OutcomeLandingFeedback? {
        guard !hasPlayed else { return nil }
        switch phase {
        case .success: return .success
        case .failure: return .error
        case .unknown: return .warning
        case .loading, .pending: return nil
        }
    }
}
