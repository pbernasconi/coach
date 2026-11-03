import Foundation

/// Every user intent on the planning screen, named for what happened (SCR-1).
nonisolated enum WeekPlannerAction: Equatable, Sendable {
    /// A step in the progress header, or "Start with last week".
    case stepChanged(WeekPlannerState.Step)
    /// Next and Back in the bottom bar.
    case nextTapped
    case backTapped
    /// A week in the week picker (its Monday): the planner opens on it.
    case weekPicked(String)
    case retryTapped
    case refreshPulled
    /// A feel chip: tapping the picked one clears it.
    case feelTapped(String)
    case hoursChanged(Int)
    case liftsPicked(Int?)
    case hardPicked(Int?)
    case longDayPicked(String?)
    /// Free, Busy, Travelling, Rest or Sick for one day on Your week.
    case dayModePicked(String, PlannerAnswers.DayMode)
    /// The note box under a day on Your week: the date and the text.
    case dayNoteChanged(String, String)
    case anythingChanged(String)
    /// "Draft my week", "Try again", or "Redraw with these answers".
    case draftTapped
    case noteChanged(String)
    case noteSent
    case quickAskTapped(String)
    case undoTapped
    case sessionTapped(Int)
    case slotPicked(PlannerWeek.Slot)
    /// The length stepper: the new length in minutes.
    case lengthChanged(Int)
    case removeTapped
    case swapTapped
    /// "Accept" in the top bar: opens Review, or accepts once there.
    case acceptTapped
    /// "Accept and sync" on Review.
    case acceptConfirmed
    case destinationDismissed
}
