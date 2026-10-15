import Foundation
import LiftStore

/// Every user intent on the Week screen, named for what happened (SCR-1).
nonisolated enum WeekAction: Equatable, Sendable {
    case daySelected(Date)
    case weekChanged(Int)
    case sessionTapped(UUID)
    /// The "…" button of a planned session: opens the lift sheet.
    case sessionOptionsTapped(UUID)
    /// "Move to another day" in the lift sheet: opens the day picker.
    case moveTapped(UUID)
    /// A day picked in the day picker.
    case moveDayPicked(UUID, Date)
    case pushToNextWeekTapped(UUID)
    case removeTapped(UUID)
    /// "Undo" on the toast after a lift sheet action.
    case undoTapped(RescheduleUndo)
    case destinationDismissed
}
