import Foundation
import LiftSync

/// Everything the Lift overview renders: the coach's Lift page (`/api/app/lift`) and what is folded. Exclusive states
/// are enums or optionals (SCR-6).
nonisolated struct LiftOverviewState: Equatable, Sendable {
    var overview = AppResourceState<LiftOverview>()
    var isOlderSessionsExpanded = false
    var isExercisesExpanded = false
    /// The section a coach tip asked for; the Content scrolls to it when `serial` changes.
    var scrollTarget: LiftOverviewScroll?
}

/// A request to scroll to one section of the overview. `serial` changes with every request, so the same section can be
/// asked for twice.
nonisolated struct LiftOverviewScroll: Equatable, Sendable {
    var section: LiftOverviewSection
    var serial: Int
}

/// The sections a coach tip can point at (`link.section`), as scroll ids.
nonisolated enum LiftOverviewSection: String, CaseIterable, Hashable, Sendable {
    case muscles, records, consistency, sessions
}

extension LiftOverview {
    /// The App API path of this page.
    static let path = "api/app/lift"
}
