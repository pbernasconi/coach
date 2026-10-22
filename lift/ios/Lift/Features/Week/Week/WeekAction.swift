import Foundation
import LiftCore
import LiftStore

/// Every user intent on the Week screen, named for what happened (SCR-1).
nonisolated enum WeekAction: Equatable, Sendable {
    /// A day picked in the week strip.
    case daySelected(Date)
    /// A rest day's row tapped in the list.
    case dayTapped(LocalDay)
    case weekChanged(Int)
    /// The header's calendar button: switches the top between the week strip and the month calendar.
    case calendarToggled
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
    /// "Add workout" in the header (nil: the selected day): opens the template picker.
    case addWorkoutTapped(LocalDay?)
    /// A template picked for a day: plans a session from it there.
    case templatePicked(UUID, on: LocalDay)
    /// "Blank workout" picked for a day: makes an empty session there and opens it.
    case blankWorkoutPicked(LocalDay)
    /// "Change workout" in the lift sheet: opens the template picker for that session.
    case changeWorkoutTapped(UUID)
    /// A template picked for a session: swaps the session's exercises for the template's.
    case changeTemplatePicked(UUID, to: UUID)
    /// "Undo" on the toast after Change workout.
    case templateUndoTapped(TemplateChangeUndo)
    /// "New template" (no templates yet): makes one and opens its editor.
    case newTemplateTapped
    /// A coach plan item tapped: opens its workout page, the activity, or the Lift session.
    case planItemTapped(String)
}
