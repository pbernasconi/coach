import Foundation
import LiftCore

/// Every user intent on the History screen, named for what happened (SCR-1).
nonisolated enum HistoryAction: Equatable, Sendable {
    case sessionTapped(UUID)
    /// The header's import button: opens Import from Notes.
    case importTapped
    /// The Sessions | Progress picker.
    case segmentChanged(HistorySegment)
    /// The arrows beside the week's title picked the week before or after.
    case volumeWeekSelected(LocalDay)
    /// The 8-week trend was touched at a day (nil once it is let go, which keeps the week).
    case volumeTrendSelectionChanged(Date?)
    /// A muscle's bar: opens its exercises.
    case muscleTapped(Muscle)
    /// The muscle sheet was closed.
    case muscleDetailDismissed
}
