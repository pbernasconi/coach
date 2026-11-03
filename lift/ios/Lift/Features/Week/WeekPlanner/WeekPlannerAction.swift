import Foundation

/// Every user intent on the planning screen, named for what happened (SCR-1).
nonisolated enum WeekPlannerAction: Equatable, Sendable {
    case tabChanged(WeekPlannerState.Tab)
    case retryTapped
    case refreshPulled
    /// A feel chip: tapping the picked one clears it.
    case feelTapped(String)
    case hoursChanged(Int)
    case liftsPicked(Int?)
    case hardPicked(Int?)
    case longDayPicked(String?)
    case dayOffToggled(String)
    case anythingChanged(String)
    /// "Next: shape the week" on Last week.
    case nextTapped
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
    /// "Accept week" in the bar: opens the summary.
    case acceptTapped
    case acceptConfirmed
    case destinationDismissed
}
