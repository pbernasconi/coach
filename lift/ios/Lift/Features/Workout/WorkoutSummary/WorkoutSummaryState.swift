import Foundation
import LiftCore

/// Everything the workout summary renders. Exclusive states are enums (SCR-6).
nonisolated struct WorkoutSummaryState: Equatable, Sendable {
    /// The session's numbers; `.empty` once it was removed or if it never existed.
    var summary: Loadable<WorkoutSummaryOverview> = .loading
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
    /// "4,250".
    var volume: String
    /// "kg".
    var unit: String
    var bests: [WorkoutBestItem]
}

/// One record beaten in the workout.
nonisolated struct WorkoutBestItem: Equatable, Sendable, Identifiable {
    var id: String
    var exercise: String
    /// "Estimated 1RM · was 116.7 kg".
    var detail: String
    /// "122.5 kg".
    var value: String
}
