import Foundation
import LiftCore

/// Everything the workout summary renders. Exclusive states are enums (SCR-6).
nonisolated struct WorkoutSummaryState: Equatable, Sendable {
    /// The session's numbers; `.empty` once it was removed or if it never existed.
    var summary: Loadable<WorkoutSummaryOverview> = .loading
    /// The Apple Health row: the first-finish prompt, or "Saved"; nil shows nothing.
    var health: SummaryHealth?
}

/// The summary's Apple Health row.
nonisolated enum SummaryHealth: Equatable, Sendable {
    /// Health was never asked: offer to save this workout and later ones (the pre-prompt before the system sheet).
    case ask
    /// The workout is in Apple Health.
    case saved
}

/// A finished workout in numbers.
nonisolated struct WorkoutSummaryOverview: Equatable, Sendable {
    var title: String
    /// "Thursday, 5 March".
    var dayTitle: String
    /// "52 min"; nil when it is not known.
    var duration: String?
    /// "9".
    var sets: String
    var bests: [WorkoutBestItem]
}

/// One exercise's records in the workout, as one row.
nonisolated struct WorkoutBestItem: Equatable, Sendable, Identifiable {
    var id: String
    var exercise: String
    /// "65 kg × 5 · est. 1RM 76 kg (was 73)": the set behind the record and the estimated 1RM.
    var detail: String
    /// The headline: the heavier set's load ("65 kg"), or the estimate when no set was heavier.
    var value: String
}
